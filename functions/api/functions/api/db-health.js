status: result?.ok === 1 ? "ok" : "error",
      database: "connected"
    });
  } catch {
    return Response.json(
      { status: "error", message: "Database connection failed" },
      { status: 500 }
    );
  }
}
