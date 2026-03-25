import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Simple HMAC-like token generation using Web Crypto
async function generateStreamToken(channelId: string, deviceId: string, userId: string, expiresAt: number): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const data = `${channelId}:${deviceId}:${userId}:${expiresAt}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const hash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(JSON.stringify({ d: data, h: hash, e: expiresAt }));
}

async function verifyStreamToken(token: string): Promise<{ valid: boolean; channelId?: string; deviceId?: string; userId?: string }> {
  try {
    const { d, h, e } = JSON.parse(atob(token));
    if (Date.now() > e) return { valid: false };
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(d));
    const expectedHash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (h !== expectedHash) return { valid: false };
    const [channelId, deviceId, userId] = d.split(':');
    return { valid: true, channelId, deviceId, userId };
  } catch {
    return { valid: false };
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let action = url.searchParams.get('action');

    if (!action && req.method === 'POST') {
      try {
        const clonedReq = req.clone();
        const body = await clonedReq.json();
        if (typeof body?.action === 'string') {
          action = body.action;
        }
      } catch {
        // ignore invalid JSON here; main handler will validate later
      }
    }

    // Action 1: Generate a stream token (requires auth)
    if (action === 'get_token') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const { data: { user }, error: userError } = await supabase.auth.getUser();
      if (userError || !user) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      const userId = user.id;
      const body = await req.json();
      const { channel_id, channel_url, device_id } = body;

      if (!channel_id || !channel_url || !device_id) {
        return new Response(JSON.stringify({ error: 'Missing channel_id, channel_url, or device_id' }), { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Use service role client for checking subscription/device
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Check trial / subscription access
      const { data: profile } = await adminClient
        .from('profiles')
        .select('trial_ends_at')
        .eq('user_id', userId)
        .maybeSingle();

      const nowIso = new Date().toISOString();
      const hasTrialAccess = !!profile?.trial_ends_at && profile.trial_ends_at > nowIso;

      const { data: sub } = await adminClient
        .from('subscriptions')
        .select('id, plan_type, expires_at')
        .eq('user_id', userId)
        .eq('status', 'active')
        .or(`plan_type.eq.lifetime,expires_at.gte.${nowIso}`)
        .limit(1)
        .maybeSingle();

      if (!sub && !hasTrialAccess) {
        return new Response(JSON.stringify({ error: 'No active subscription or trial access' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Check device is active and belongs to user
      const { data: device } = await adminClient
        .from('devices')
        .select('id, is_active')
        .eq('user_id', userId)
        .eq('device_id', device_id)
        .eq('is_active', true)
        .maybeSingle();

      if (!device) {
        return new Response(JSON.stringify({ error: 'Device not authorized' }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
      }

      // Update last_seen
      await adminClient.from('devices').update({ last_seen_at: new Date().toISOString() }).eq('id', device.id);

      // Generate short-lived token (5 minutes)
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const token = await generateStreamToken(channel_id, device_id, userId, expiresAt);

      // Return tokenized URL
      const proxyBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
      const streamUrl = `${proxyBase}?action=play&token=${encodeURIComponent(token)}&url=${encodeURIComponent(channel_url)}`;

      return new Response(JSON.stringify({ stream_url: streamUrl, expires_in: 300 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Action 2: Proxy the stream (token-based, no auth header needed)
    if (action === 'play') {
      const token = url.searchParams.get('token');
      const streamUrl = url.searchParams.get('url');

      if (!token || !streamUrl) {
        return new Response('Missing token or url', { status: 400, headers: corsHeaders });
      }

      const verification = await verifyStreamToken(token);
      if (!verification.valid) {
        return new Response('Token expired or invalid', { status: 403, headers: corsHeaders });
      }

      // Proxy the stream
      const streamRes = await fetch(streamUrl, {
        headers: {
          'User-Agent': 'IPTVPlayer/1.0',
        },
      });

      if (!streamRes.ok) {
        return new Response('Stream unavailable', { status: 502, headers: corsHeaders });
      }

      // Forward the response with CORS
      const responseHeaders = new Headers(corsHeaders);
      const contentType = streamRes.headers.get('content-type');
      if (contentType) responseHeaders.set('Content-Type', contentType);
      responseHeaders.set('Cache-Control', 'no-store');

      return new Response(streamRes.body, {
        status: 200,
        headers: responseHeaders,
      });
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use get_token or play' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
