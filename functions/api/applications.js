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

  const firstName =
    typeof data.firstName === "string" ? data.firstName.trim() : "";
  const lastName =
    typeof data.lastName === "string" ? data.lastName.trim() : "";
  const email =
    typeof data.email === "string"
      ? data.email.trim().toLowerCase()
      : "";const serviceType =
  typeof data.serviceType === "string"
    ? data.serviceType.trim()
    : "";
  const servicePackage =
  typeof data.servicePackage === "string"
    ? data.servicePackage.trim().toLowerCase()
    : "";

const allowedPackages = ["basic", "complete", "premium"];

  const allowedServices = [
    "Original MMC",
    "Renewal",
    "Raise of Grade",
    "Modification / Increase of Scope",
    "STCW",
    "Duplicate",
    "Replacement",
    "Document of Continuity",
    "Additional Information"
  ];

  if (
    firstName.length < 1 ||
    firstName.length > 100 ||
    lastName.length < 1 ||
    lastName.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
    email.length > 254 ||
    !allowedServices.includes(serviceType)|| !allowedPackages.includes(servicePackage)
  ) {
    return Response.json(
      { error: "Please provide a valid name, email, and MMC service." },
      { status: 400 }
    );
  }

  const reference =
    "OO-" + crypto.randomUUID().slice(0, 8).toUpperCase();

  const uploadToken =
    crypto.randomUUID() + crypto.randomUUID();

   try {
    if (!allowedPackages.includes(servicePackage)) {
      return Response.json(
        { error: "Please select a valid service package." },
        { status: 400 }
      );
    }

    const result = await env.DB.prepare(
      `INSERT INTO applications
       (reference_number, customer_name, customer_email,
        service_type, upload_token, service_package)
       VALUES (?, ?, ?, ?, ?, ?)`
    )
      .bind(
        reference,
        `${firstName} ${lastName}`,
        email,
        serviceType,
        uploadToken,
        servicePackage
      )
      .run();

    return Response.json(
  {
    success: true,
    application_id: result.meta?.last_row_id,
    reference_number: reference,
    upload_token: uploadToken,
    message: "Application received."
  },
  { status: 201 }
);
  } catch {
    return Response.json(
      {
        error: "The application could not be saved. Please try again later."
      },
      { status: 500 }
    );
  }
}
