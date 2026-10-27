export async function onRequest({ env }) {
  try {
    const result = await env.DB.prepare("SELECT 1 AS ok").first();

    return Response.json({
      status: "ok",
      database: "connected"
    });
  } catch (error) {
    return Response.json(
      {
        status: "error",
        message: "Database connection failed"
      },
      { status: 500 }
    );
  }
}
