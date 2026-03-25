import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);

    // Find users whose trial ends in ~24 hours (between 23 and 25 hours from now)
    const now = new Date();
    const from = new Date(now.getTime() + 23 * 60 * 60 * 1000).toISOString();
    const to = new Date(now.getTime() + 25 * 60 * 60 * 1000).toISOString();

    const { data: profiles, error: profilesError } = await supabase
      .from("profiles")
      .select("user_id, display_name, trial_ends_at")
      .not("trial_ends_at", "is", null)
      .gte("trial_ends_at", from)
      .lte("trial_ends_at", to);

    if (profilesError) throw profilesError;

    let sent = 0;

    for (const profile of profiles || []) {
      // Check if user already has an active subscription
      const { data: sub } = await supabase
        .from("subscriptions")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("status", "active")
        .maybeSingle();

      if (sub) continue; // Skip users with active subscriptions

      // Check if we already sent a trial reminder
      const { data: existing } = await supabase
        .from("notifications")
        .select("id")
        .eq("user_id", profile.user_id)
        .eq("type", "trial")
        .limit(1);

      if (existing && existing.length > 0) continue; // Already notified

      // Send reminder notification
      await supabase.from("notifications").insert({
        user_id: profile.user_id,
        title: "Trial Ending Tomorrow!",
        message: `Your free trial expires tomorrow. Activate your subscription now to keep using the service without interruption.`,
        type: "trial",
        metadata: {
          trial_ends_at: profile.trial_ends_at,
          display_name: profile.display_name,
        },
      });

      sent++;
    }

    return new Response(
      JSON.stringify({ success: true, reminders_sent: sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});
