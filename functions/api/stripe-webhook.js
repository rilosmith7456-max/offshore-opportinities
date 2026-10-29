export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" },
    });
  }

  const secret = env.STRIPE_WEBHOOK_SECRET;
  const signature = request.headers.get("Stripe-Signature");

  if (!secret || !signature) {
    return new Response("Webhook configuration missing", {
      status: 400,
    });
  }

  const parts = Object.fromEntries(
    signature.split(",").map((part) => {
      const [key, ...values] = part.split("=");
      return [key, values.join("=")];
    })
  );

  const timestamp = parts.t;
  const signatures = signature
    .split(",")
    .filter((part) => part.startsWith("v1="))
    .map((part) => part.slice(3));

  if (!timestamp || signatures.length === 0) {
    return new Response("Invalid signature format", {
      status: 400,
    });
  }

  const now = Math.floor(Date.now() / 1000);

  if (Math.abs(now - Number(timestamp)) > 300) {
    return new Response("Webhook timestamp expired", {
      status: 400,
    });
  }

  const payload = await request.text();
  const signedPayload = `${timestamp}.${payload}`;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const digest = await crypto.subtle.sign(
    "HMAC",
    key,
    encoder.encode(signedPayload)
  );

  const expected = Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");

  const valid = signatures.some((candidate) => {
    if (candidate.length !== expected.length) return false;

    let difference = 0;
    for (let i = 0; i < expected.length; i++) {
      difference |= candidate.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return difference === 0;
  });

  if (!valid) {
    return new Response("Invalid webhook signature", {
      status: 400,
    });
  }

  let event;
  try {
    event = JSON.parse(payload);
  } catch {
    return new Response("Invalid JSON", { status: 400 });
  }

  
  if (event.type === "checkout.session.completed") {
    const session = event.data.object;

    // Only mark the application paid when Stripe confirms payment.
    if (session.payment_status === "paid" && session.id) {
      await env.DB.prepare(
        `UPDATE payments
         SET payment_status = 'paid'
         WHERE stripe_session_id = ?`
      )
        .bind(session.id)
        .run();

      await env.DB.prepare(
        `UPDATE applications
         SET payment_status = 'paid',
             updated_at = CURRENT_TIMESTAMP
         WHERE id = (
           SELECT application_id
           FROM payments
           WHERE stripe_session_id = ?
           LIMIT 1
         )`
      )
        .bind(session.id)
        .run();
    }
  } {
    // Signature verified. Payment-to-application matching
    // and fulfillment still need to be implemented.
  }

  return Response.json({ received: true });
}
