import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function validateAccess(authHeader: string, channelUrl: string) {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );

  const token = authHeader.replace("Bearer ", "");
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);

  if (claimsError || !claimsData?.claims?.sub) {
    return {
      ok: false,
      status: 401,
      body: { ok: false, error: "Unauthorized" },
    };
  }

  const userId = claimsData.claims.sub as string;

  const adminClient = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: profile } = await adminClient
    .from("profiles")
    .select("trial_ends_at")
    .eq("user_id", userId)
    .maybeSingle();

  const nowIso = new Date().toISOString();
  const hasTrialAccess = !!profile?.trial_ends_at && profile.trial_ends_at > nowIso;

  const { data: sub } = await adminClient
    .from("subscriptions")
    .select("id, plan_type, expires_at")
    .eq("user_id", userId)
    .eq("status", "active")
    .or(`plan_type.eq.lifetime,expires_at.gte.${nowIso}`)
    .limit(1)
    .maybeSingle();

  if (!sub && !hasTrialAccess) {
    return {
      ok: false,
      status: 403,
      body: {
        ok: false,
        error: "No active subscription or trial",
        is_trial: false,
        is_active: false,
      },
    };
  }

  return {
    ok: true,
    status: 200,
    body: {
      ok: true,
      stream_url: channelUrl,
      is_trial: hasTrialAccess && !sub,
      is_active: !!sub,
      plan_type: sub?.plan_type || "trial",
      expires_at: sub?.expires_at || profile?.trial_ends_at,
    },
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    let body: Record<string, unknown> | null = null;

    if (req.method === "POST") {
      try {
        body = await req.json();
      } catch {
        body = null;
      }
    }

    const action = (typeof body?.action === "string" ? body.action : null) || url.searchParams.get("action") || "validate";

    if (action === "play") {
      const targetUrl = url.searchParams.get("url");
      if (!targetUrl) {
        return new Response("Missing url", { status: 400, headers: corsHeaders });
      }

      return Response.redirect(targetUrl, 302);
    }

    if (action !== "validate" && action !== "get_token") {
      return new Response(JSON.stringify({ error: "Invalid action. Use validate, get_token, or play" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ ok: false, error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const channelUrl = typeof body?.channel_url === "string"
      ? body.channel_url
      : url.searchParams.get("url") || "";

    const result = await validateAccess(authHeader, channelUrl);

    if (!result.ok) {
      return new Response(JSON.stringify(result.body), {
        status: result.status,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get_token") {
      return new Response(JSON.stringify({
        stream_url: result.body.stream_url,
        expires_in: 300,
        is_trial: result.body.is_trial,
        is_active: result.body.is_active,
        plan_type: result.body.plan_type,
        expires_at: result.body.expires_at,
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result.body), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error(`[stream-proxy] Error: ${message}`);
    return new Response(JSON.stringify({ ok: false, error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});