import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Paymob HMAC verification
async function verifyPaymobHMAC(
  data: Record<string, any>,
  hmac: string,
  secret: string
): Promise<boolean> {
  // Paymob concatenates specific fields in order
  const fields = [
    "amount_cents", "created_at", "currency", "error_occured",
    "has_parent_transaction", "id", "integration_id", "is_3d_secure",
    "is_auth", "is_capture", "is_refunded", "is_standalone_payment",
    "is_voided", "order", "owner", "pending",
    "source_data_pan", "source_data_sub_type", "source_data_type", "success",
  ];

  const concatenated = fields.map((f) => {
    const keys = f.split("_");
    let val = data;
    // Navigate nested: source_data_pan → source_data.pan
    if (f.startsWith("source_data_")) {
      const subKey = f.replace("source_data_", "");
      val = data.source_data?.[subKey] ?? "";
      return String(val);
    }
    return String(data[f] ?? "");
  }).join("");

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret),
    { name: "HMAC", hash: "SHA-512" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(concatenated));
  const computed = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  return computed === hmac;
}

function getExpiration(planType: string): string {
  const now = new Date();
  switch (planType) {
    case "monthly": return new Date(now.getTime() + 30 * 86400000).toISOString();
    case "yearly": return new Date(now.getTime() + 365 * 86400000).toISOString();
    case "lifetime": return "2099-12-31T23:59:59Z";
    default: return new Date(now.getTime() + 30 * 86400000).toISOString();
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
    const hmacSecret = Deno.env.get("PAYMOB_HMAC_SECRET");
    if (!hmacSecret) throw new Error("PAYMOB_HMAC_SECRET not configured");

    const body = await req.json();
    const txn = body.obj || body;
    const hmac = body.hmac || req.headers.get("hmac") || "";

    // Verify HMAC
    const valid = await verifyPaymobHMAC(txn, hmac, hmacSecret);
    if (!valid) {
      console.error("Invalid Paymob HMAC signature");
      return new Response(JSON.stringify({ error: "Invalid signature" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const txnId = String(txn.id || "");
    const orderId = String(txn.order?.id || txn.order || "");
    const success = txn.success === true || txn.success === "true";
    const amountCents = txn.amount_cents || 0;
    const currency = txn.currency || "EGP";

    // Extract user_id and plan_type from order extras or merchant_order_id
    // Paymob allows passing custom data via merchant_order_id format: userId__planType
    const merchantOrderId = txn.order?.merchant_order_id || txn.merchant_order_id || "";
    const [userId, planType = "monthly"] = merchantOrderId.split("__");

    if (!userId) {
      console.error("No user_id in merchant_order_id");
      return new Response(JSON.stringify({ error: "Missing user_id" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Prevent duplicates
    const { data: existing } = await supabase
      .from("payments")
      .select("id")
      .eq("provider", "paymob")
      .eq("provider_payment_id", txnId)
      .eq("status", "completed")
      .maybeSingle();

    if (existing) {
      return new Response(JSON.stringify({ message: "Already processed" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Record payment
    await supabase.from("payments").insert({
      user_id: userId,
      provider: "paymob",
      provider_payment_id: txnId,
      provider_order_id: orderId,
      plan_type: planType,
      amount_cents: amountCents,
      currency: currency,
      status: success ? "completed" : "failed",
      metadata: {
        source_type: txn.source_data?.type,
        source_sub_type: txn.source_data?.sub_type,
        is_3d_secure: txn.is_3d_secure,
      },
    });

    if (success) {
      const expiresAt = getExpiration(planType);

      await supabase.from("subscriptions").insert({
        user_id: userId,
        status: "active",
        plan_type: planType,
        expires_at: expiresAt,
        max_devices: 3,
      });

      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Payment Successful!",
        message: planType === "lifetime"
          ? "Your lifetime subscription is now active. Enjoy unlimited access!"
          : `Your ${planType} subscription is active until ${new Date(expiresAt).toLocaleDateString()}.`,
        type: "subscription",
        metadata: { plan_type: planType, expires_at: expiresAt, provider: "paymob" },
      });

      console.log(`Paymob: Activated ${planType} for user ${userId}`);
    } else {
      await supabase.from("notifications").insert({
        user_id: userId,
        title: "Payment Failed",
        message: "Your payment could not be processed. Please try again.",
        type: "error",
        metadata: { provider: "paymob", txn_id: txnId },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Paymob webhook error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
