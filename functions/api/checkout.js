
export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Use POST to start checkout." },
      { status: 405, headers: { Allow: "POST" } }
    );
  }

  if (!env.DB || !env.STRIPE_SECRET_KEY) {
    return Response.json(
      { error: "Checkout is not configured." },
      { status: 500 }
    );
  }

  let data;
  try {
    data = await request.json();
  } catch {
    return Response.json(
      { error: "Invalid request." },
      { status: 400 }
    );
  }

  const applicationId = Number(data.applicationId);

  if (!Number.isSafeInteger(applicationId) || applicationId < 1) {
    return Response.json(
      { error: "A valid application is required." },
      { status: 400 }
    );
  }

  try {
    const application = await env.DB.prepare(
      `SELECT id, reference_number, customer_email, service_package
       FROM applications
       WHERE id = ?`
    )
      .bind(applicationId)
      .first();

    if (!application) {
      return Response.json(
        { error: "Application not found." },
        { status: 404 }
      );
    }

    const packages = {
      basic: { amount: 25000, name: "Basic Assistance" },
      complete: { amount: 30000, name: "Complete Package" },
      premium: { amount: 45000, name: "Premium Support" }
    };

    const selectedPackage = packages[application.service_package];

    if (!selectedPackage) {
      return Response.json(
        { error: "Invalid application package." },
        { status: 400 }
      );
    }

    const origin = new URL(request.url).origin;
    const form = new URLSearchParams();

    form.set("mode", "payment");
    form.set("success_url", `${origin}/?payment=success&session_id={CHECKOUT_SESSION_ID}`);
    form.set("cancel_url", `${origin}/?payment=cancelled`);
    form.set("customer_email", application.customer_email);
    form.set("client_reference_id", application.reference_number);
    form.set("metadata[application_id]", String(application.id));
    form.set("metadata[reference_number]", application.reference_number);
    form.set("line_items[0][price_data][currency]", "usd");
    form.set("line_items[0][price_data][unit_amount]", String(selectedPackage.amount));
    form.set("line_items[0][price_data][product_data][name]", selectedPackage.name);
    form.set("line_items[0][quantity]", "1");

    const stripeResponse = await fetch(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
          "Content-Type": "application/x-www-form-urlencoded"
        },
        body: form.toString()
      }
    );

    const session = await stripeResponse.json();

    if (!stripeResponse.ok || !session.url) {
      return Response.json(
        { error: "Stripe could not create checkout. Please try again." },
        { status: 502 }
      );
    }

    await env.DB.prepare(
      `INSERT INTO payments
       (application_id, stripe_session_id, amount_cents, currency, payment_status)
       VALUES (?, ?, ?, 'usd', 'pending')`
    )
      .bind(application.id, session.id, selectedPackage.amount)
      .run();

    return Response.json({ url: session.url });
  } catch {
    return Response.json(
      { error: "Checkout could not be started. Please try again." },
      { status: 500 }
    );
  }
}
