
export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Use POST to submit an application." },
      { status: 405, headers: { Allow: "POST" } }
    );
  }

  if (!env.DB) {
    return Response.json(
      { error: "Database is not configured." },
      { status: 500 }
    );
  }

  let data;

  try {
    data = await request.json();
  } catch {
    return Response.json(
      { error: "Please submit valid JSON." },
      { status: 400 }
    );
  }

  const name =
    typeof data.name === "string" ? data.name.trim() : "";
  const email =
    typeof data.email === "string" ? data.email.trim().toLowerCase() : "";
  const service =
    typeof data.service_package === "string"
      ? data.service_package.trim()
      : "";

  const allowedPackages = [
    "Basic Assistance",
    "Complete Package",
    "Premium Support"
  ];

  if (
    name.length < 2 ||
    name.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !allowedPackages.includes(service)
  ) {
    return Response.json(
      { error: "Please provide a valid name, email, and service package." },
      { status: 400 }
    );
  }

  const reference = "OO-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  try {
    await env.DB.prepare(
      `INSERT INTO applications
       (reference_number, customer_name, customer_email, service_package)
       VALUES (?, ?, ?, ?)`
    )
      .bind(reference, name, email, service)
      .run();

    return Response.json(
      {
        success: true,
        reference_number: reference,
        message: "Application received."
      },
      { status: 201 }
    );
  } catch {
    return Response.json(
      { error: "The application could not be saved. Please try again later." },
      { status: 500 }
    );
  }
}
