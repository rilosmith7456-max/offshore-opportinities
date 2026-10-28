export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return new Response("Method not allowed", {
      status: 405,
      headers: { Allow: "POST" }
    });
  }

  return Response.json(
    {
      error:
        "Stripe webhook verification is not configured yet."
    },
    { status: 501 }
  );
}
