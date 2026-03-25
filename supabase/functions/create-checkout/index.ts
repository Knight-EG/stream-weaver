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
    const { provider, plan_type } = await req.json();

    if (!provider || !plan_type) {
      return new Response(JSON.stringify({ error: "Missing provider or plan_type" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider === "lemonsqueezy") {
      const apiKey = Deno.env.get("LEMONSQUEEZY_API_KEY");
      if (!apiKey) throw new Error("LEMONSQUEEZY_API_KEY not configured");

      // Plan variant IDs should be configured as secrets
      const variantIds: Record<string, string> = {
        monthly: Deno.env.get("LS_VARIANT_MONTHLY") || "",
        yearly: Deno.env.get("LS_VARIANT_YEARLY") || "",
        lifetime: Deno.env.get("LS_VARIANT_LIFETIME") || "",
      };

      const variantId = variantIds[plan_type];
      if (!variantId) {
        return new Response(JSON.stringify({ error: "Plan not configured" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Create Lemon Squeezy checkout
      const lsResponse = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "Content-Type": "application/vnd.api+json",
          "Accept": "application/vnd.api+json",
        },
        body: JSON.stringify({
          data: {
            type: "checkouts",
            attributes: {
              custom_price: null,
              product_options: { redirect_url: `${Deno.env.get("SUPABASE_URL")?.replace('.supabase.co', '.lovable.app')}/subscription?status=success` },
              checkout_data: {
                custom: { user_id: userId, plan_type },
              },
            },
            relationships: {
              store: { data: { type: "stores", id: Deno.env.get("LS_STORE_ID") || "" } },
              variant: { data: { type: "variants", id: variantId } },
            },
          },
        }),
      });

      const lsData = await lsResponse.json();
      if (!lsResponse.ok) {
        throw new Error(`Lemon Squeezy error: ${JSON.stringify(lsData)}`);
      }

      const checkoutUrl = lsData.data?.attributes?.url;
      return new Response(JSON.stringify({ checkout_url: checkoutUrl, provider: "lemonsqueezy" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (provider === "paymob") {
      const paymobApiKey = Deno.env.get("PAYMOB_API_KEY");
      if (!paymobApiKey) throw new Error("PAYMOB_API_KEY not configured");

      // Step 1: Auth token
      const authRes = await fetch("https://accept.paymob.com/api/auth/tokens", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ api_key: paymobApiKey }),
      });
      const authData = await authRes.json();
      const paymobToken = authData.token;

      // Plan prices in EGP cents
      const prices: Record<string, number> = {
        monthly: Number(Deno.env.get("PAYMOB_PRICE_MONTHLY") || "5000"),   // 50 EGP
        yearly: Number(Deno.env.get("PAYMOB_PRICE_YEARLY") || "50000"),    // 500 EGP
        lifetime: Number(Deno.env.get("PAYMOB_PRICE_LIFETIME") || "150000"), // 1500 EGP
      };

      const amountCents = prices[plan_type] || 5000;

      // Step 2: Create order
      const orderRes = await fetch("https://accept.paymob.com/api/ecommerce/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: paymobToken,
          delivery_needed: false,
          amount_cents: amountCents,
          currency: "EGP",
          merchant_order_id: `${userId}__${plan_type}`,
          items: [{ name: `IPTV ${plan_type} Plan`, amount_cents: amountCents, quantity: 1 }],
        }),
      });
      const orderData = await orderRes.json();

      // Step 3: Payment key
      const integrationId = Deno.env.get("PAYMOB_INTEGRATION_ID") || "";
      const keyRes = await fetch("https://accept.paymob.com/api/acceptance/payment_keys", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          auth_token: paymobToken,
          amount_cents: amountCents,
          expiration: 3600,
          order_id: orderData.id,
          billing_data: {
            first_name: "IPTV", last_name: "User",
            email: claims.claims.email || "user@example.com",
            phone_number: "NA", apartment: "NA", floor: "NA",
            street: "NA", building: "NA", shipping_method: "NA",
            postal_code: "NA", city: "NA", country: "EG", state: "NA",
          },
          currency: "EGP",
          integration_id: Number(integrationId),
        }),
      });
      const keyData = await keyRes.json();

      const iframeId = Deno.env.get("PAYMOB_IFRAME_ID") || "";
      const checkoutUrl = `https://accept.paymob.com/api/acceptance/iframes/${iframeId}?payment_token=${keyData.token}`;

      return new Response(JSON.stringify({ checkout_url: checkoutUrl, provider: "paymob" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Unknown provider" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Create checkout error:", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
