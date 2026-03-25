import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// HMAC token generation
async function generateStreamToken(channelId: string, userId: string, expiresAt: number): Promise<string> {
  const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const data = `${channelId}:${userId}:${expiresAt}`;
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(data));
  const hash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
  return btoa(JSON.stringify({ d: data, h: hash, e: expiresAt }));
}

async function verifyStreamToken(token: string): Promise<{ valid: boolean; channelId?: string; userId?: string }> {
  try {
    const { d, h, e } = JSON.parse(atob(token));
    if (Date.now() > e) return { valid: false };
    const secret = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
    const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(d));
    const expectedHash = Array.from(new Uint8Array(signature)).map(b => b.toString(16).padStart(2, '0')).join('');
    if (h !== expectedHash) return { valid: false };
    const parts = d.split(':');
    return { valid: true, channelId: parts[0], userId: parts[1] };
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
    
    // Extract action from query params OR POST body
    let action = url.searchParams.get('action');
    let body: any = null;

    if (req.method === 'POST') {
      try {
        body = await req.json();
        if (!action && typeof body?.action === 'string') {
          action = body.action;
        }
      } catch {
        // Not JSON - that's ok for some actions
      }
    }

    console.log(`[stream-proxy] action=${action}, method=${req.method}`);

    // === GET TOKEN (requires auth) ===
    if (action === 'get_token') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader?.startsWith('Bearer ')) {
        console.log('[stream-proxy] Missing auth header');
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Verify user
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_ANON_KEY')!,
        { global: { headers: { Authorization: authHeader } } }
      );

      const token = authHeader.replace('Bearer ', '');
      const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
      if (claimsError || !claimsData?.claims?.sub) {
        console.log('[stream-proxy] Auth failed:', claimsError?.message);
        return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
          status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      const userId = claimsData.claims.sub as string;
      const { channel_id, channel_url } = body || {};

      if (!channel_id || !channel_url) {
        return new Response(JSON.stringify({ error: 'Missing channel_id or channel_url' }), { 
          status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      // Admin client for DB checks
      const adminClient = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );

      // Check trial OR subscription
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
        console.log(`[stream-proxy] No access for user ${userId}`);
        return new Response(JSON.stringify({ error: 'No active subscription or trial' }), { 
          status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        });
      }

      console.log(`[stream-proxy] Access granted for user ${userId}, trial=${hasTrialAccess}, sub=${!!sub}`);

      // Generate 5-minute token
      const expiresAt = Date.now() + 5 * 60 * 1000;
      const streamToken = await generateStreamToken(channel_id, userId, expiresAt);

      const proxyBase = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stream-proxy`;
      const streamUrl = `${proxyBase}?action=play&token=${encodeURIComponent(streamToken)}&url=${encodeURIComponent(channel_url)}`;

      return new Response(JSON.stringify({ stream_url: streamUrl, expires_in: 300 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // === PLAY STREAM (token-based, no auth needed) ===
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

      console.log(`[stream-proxy] Proxying stream for channel=${verification.channelId}`);

      // Proxy the stream with timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);

      try {
        const streamRes = await fetch(streamUrl, {
          headers: { 'User-Agent': 'IPTVPlayer/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timeout);

        if (!streamRes.ok) {
          console.log(`[stream-proxy] Upstream returned ${streamRes.status}`);
          return new Response('Stream unavailable', { status: 502, headers: corsHeaders });
        }

        const responseHeaders = new Headers(corsHeaders);
        const contentType = streamRes.headers.get('content-type');
        if (contentType) responseHeaders.set('Content-Type', contentType);
        responseHeaders.set('Cache-Control', 'no-store');

        return new Response(streamRes.body, { status: 200, headers: responseHeaders });
      } catch (fetchErr) {
        clearTimeout(timeout);
        console.log(`[stream-proxy] Fetch error: ${fetchErr.message}`);
        return new Response('Stream fetch failed', { status: 502, headers: corsHeaders });
      }
    }

    return new Response(JSON.stringify({ error: 'Invalid action. Use get_token or play' }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[stream-proxy] Unhandled error: ${error.message}`);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
