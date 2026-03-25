import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Authenticate user
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claims, error: claimsErr } = await supabase.auth.getClaims(token);
    if (claimsErr || !claims?.claims) {
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = claims.claims.sub as string;
    const url = new URL(req.url);
    const deviceId = url.searchParams.get("device_id");

    // Get profile (trial info)
    const { data: profile } = await supabase
      .from("profiles")
      .select("trial_ends_at, max_devices")
      .eq("user_id", userId)
      .single();

    const now = new Date();
    const trialEndsAt = profile?.trial_ends_at ? new Date(profile.trial_ends_at) : null;
    const isTrial = trialEndsAt ? now < trialEndsAt : false;
    const trialDaysLeft = trialEndsAt
      ? Math.max(0, Math.ceil((trialEndsAt.getTime() - now.getTime()) / 86400000))
      : 0;

    // Get active subscription
    const { data: sub } = await supabase
      .from("subscriptions")
      .select("status, expires_at, plan_type, max_devices")
      .eq("user_id", userId)
      .eq("status", "active")
      .gte("expires_at", now.toISOString())
      .order("expires_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const hasSubscription = !!sub;
    const isLifetime = sub?.plan_type === "lifetime";
    const isActive = isTrial || hasSubscription;

    // Check device if provided
    let deviceValid = true;
    if (deviceId) {
      const { data: device } = await supabase
        .from("devices")
        .select("id, is_active")
        .eq("device_id", deviceId)
        .eq("user_id", userId)
        .maybeSingle();

      if (device && !device.is_active) {
        deviceValid = false;
      }
    }

    const response = {
      is_active: isActive && deviceValid,
      is_trial: isTrial && !hasSubscription,
      trial_days_left: trialDaysLeft,
      has_subscription: hasSubscription,
      plan_type: isLifetime ? "lifetime" : sub?.plan_type || (isTrial ? "trial" : "none"),
      expires_at: isLifetime ? "2099-12-31T23:59:59Z" : sub?.expires_at || trialEndsAt?.toISOString() || null,
      max_devices: sub?.max_devices || profile?.max_devices || 3,
      device_valid: deviceValid,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
