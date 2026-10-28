
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_TYPES = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png"
]);

const ALLOWED_EXTENSIONS = new Set([
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png"
]);

export async function onRequest({ request, env }) {
  if (request.method !== "POST") {
    return Response.json(
      { error: "Use POST to upload documents." },
      { status: 405, headers: { Allow: "POST" } }
    );
  }

 if (!env.DB) {
  return Response.json(
    { error: "The DB database binding is missing." },
    { status: 500 }
  );
}

if (!env.Documents) {
  return Response.json(
    { error: "The DOCUMENTS storage binding is missing." },
    { status: 500 }
  );
}

  const token = request.headers.get("X-Upload-Token") || "";

  if (token.length < 60 || token.length > 100) {
    return Response.json(
      { error: "A valid upload token is required." },
      { status: 401 }
    );
  }

  let application;

  try {
    application = await env.DB.prepare(
      "SELECT id FROM applications WHERE upload_token = ?"
    )
      .bind(token)
      .first();
  } catch {
    return Response.json(
      { error: "Could not verify the application." },
      { status: 500 }
    );
  }

  if (!application) {
    return Response.json(
      { error: "Application not found or upload token is invalid." },
      { status: 401 }
    );
  }

  let form;

  try {
    form = await request.formData();
  } catch {
    return Response.json(
      { error: "Please submit files using a form upload." },
      { status: 400 }
    );
  }

  const files = form.getAll("files").filter(
    value => typeof value === "object" &&
      value !== null &&
      typeof value.arrayBuffer === "function"
  );

  if (files.length < 1 || files.length > 10) {
    return Response.json(
      { error: "Please upload between 1 and 10 files at a time." },
      { status: 400 }
    );
  }

  const uploaded = [];

  for (const file of files) {
    const originalName = String(file.name || "document");
    const extension = originalName.includes(".")
      ? "." + originalName.split(".").pop().toLowerCase()
      : "";

    if (
      file.size < 1 ||
      file.size > MAX_FILE_SIZE ||
      !ALLOWED_TYPES.has(file.type) ||
      !ALLOWED_EXTENSIONS.has(extension)
    ) {
      return Response.json(
        {
          error:
            "Each file must be a PDF, JPG, or PNG no larger than 10 MB."
        },
        { status: 400 }
      );
    }
  }

  try {
    for (const file of files) {
      const key =
        `applications/${application.id}/${crypto.randomUUID()}`;

      await env.Documents.put(key, file.stream(), {
        httpMetadata: {
          contentType: file.type
        },
        customMetadata: {
          applicationId: String(application.id),
          originalFilename: String(file.name || "document")
            .replace(/[\/\\\r\n]/g, "_")
            .slice(0, 200)
        }
      });

      uploaded.push({
        filename: String(file.name || "document"),
        size: file.size
      });
    }

    return Response.json(
      {
        success: true,
        message: "Documents uploaded to private storage.",
        files: uploaded
      },
      { status: 201 }
    );
  } catch {
    return Response.json(
      { error: "An upload failed. Please try again." },
      { status: 500 }
    );
  }
}
