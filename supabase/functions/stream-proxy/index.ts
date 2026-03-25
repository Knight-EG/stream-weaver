import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

/**
 * Stream Access Validator
 * 
 * This function does NOT proxy the stream itself.
 * It validates that the user has an active trial/subscription,
 * then returns the original stream URL for the client to play directly.
 * 
 * This avoids edge function timeout issues and unnecessary bandwidth usage.
 */
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Parse body
    let body: any = null;
    if (req.method === 'POST') {
      try { body = await req.json(); } catch { /* ignore */ }
    }

    const action = body?.action || new URL(req.url).searchParams.get('action');

    if (action !== 'validate') {
      return new Response(JSON.stringify({ error: 'Use action=validate' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Auth check
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace('Bearer ', '');
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      return new Response(JSON.stringify({ ok: false, error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userId = claimsData.claims.sub as string;
    const { channel_id, channel_url } = body || {};

    if (!channel_id || !channel_url) {
      return new Response(JSON.stringify({ ok: false, error: 'Missing channel_id or channel_url' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
      return new Response(JSON.stringify({ 
        ok: false, 
        error: 'No active subscription or trial',
        is_trial: false,
        is_active: false,
      }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Access granted - return the original URL for direct playback
    return new Response(JSON.stringify({
      ok: true,
      stream_url: channel_url, // Client plays this directly
      is_trial: hasTrialAccess && !sub,
      is_active: !!sub,
      plan_type: sub?.plan_type || 'trial',
      expires_at: sub?.expires_at || profile?.trial_ends_at,
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error(`[stream-proxy] Error: ${error.message}`);
    return new Response(JSON.stringify({ ok: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
