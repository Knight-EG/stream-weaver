import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Lemon Squeezy webhook signature verification
async function verifyLemonSqueezySignature(
  payload: string,
  signature: string,
  secret: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return computed === signature;
}

// Plan duration mapping
function getExpiration(planType: string): string {
  const now = new Date();
  switch (planType) {
    case "monthly":
      return new Date(now.getTime() + 30 * 86400000).toISOString();
    case "yearly":
      return new Date(now.getTime() + 365 * 86400000).toISOString();
    case "lifetime":
      return "2099-12-31T23:59:59Z";
    default:
      return new Date(now.getTime() + 30 * 86400000).toISOString();
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("LEMONSQUEEZY_WEBHOOK_SECRET");
    if (!webhookSecret) {
      throw new Error("LEMONSQUEEZY_WEBHOOK_SECRET not configured");
    }

    const body = await req.text();

    // Verify signature
    const signature = req.headers.get("x-signature") || "";
    const valid = await verifyLemonSqueezySignature(body, signature, webhookSecret);
    if (!valid) {
      console.error("Invalid Lemon Squeezy webhook signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const event = JSON.parse(body);
    const eventName = event.meta?.event_name;
    const customData = event.meta?.custom_data || {};
    const userId = customData.user_id;

    if (!userId) {
      console.error("No user_id in custom_data");
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const orderId = String(event.data?.id || "");
    const planType = customData.plan_type || "monthly";

    // Prevent duplicate processing
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("provider", "lemonsqueezy")
      .eq("provider_order_id", orderId)
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (eventName === "order_created" || eventName === "subscription_payment_success") {
      const attrs = event.data?.attributes || {};
      const amountCents = attrs.total || attrs.subtotal || 0;
      const currency = attrs.currency || "USD";

      // Record payment
      await supabase.from("payments").insert({
        user_id: userId,
        provider: "lemonsqueezy",
        provider_payment_id: String(attrs.first_order_item?.id || orderId),
        provider_order_id: orderId,
        plan_type: planType,
        amount_cents: amountCents,
        currency: currency.toUpperCase(),
        status: "completed",
        metadata: { event_name: eventName, order_id: orderId },
      });

      // Activate subscription
      const expiresAt = getExpiration(planType);
      await supabase.from("subscriptions").insert({
        user_id: userId,
        status: "active",
        plan_type: planType,
        expires_at: expiresAt,
        max_devices: 3,
      });

      // Notify user
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Subscription Activated!",
        message: planType === "lifetime"
          ? "Your lifetime subscription is now active. Enjoy unlimited access!"
          : `Your ${planType} subscription is now active until ${new Date(expiresAt).toLocaleDateString()}.`,
        type: "subscription",
        metadata: { plan_type: planType, expires_at: expiresAt, provider: "lemonsqueezy" },
      });

      console.log(`Activated ${planType} subscription for user ${userId}`);
    }

    if (eventName === "subscription_expired" || eventName === "subscription_cancelled") {
      await supabase
        .from("subscriptions")
        .update({ status: "expired" })
        .eq("user_id", userId)
        .eq("status", "active");

      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Subscription Expired",
        message: "Your subscription has expired. Renew to continue using the service.",
        type: "warning",
        metadata: { provider: "lemonsqueezy" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
