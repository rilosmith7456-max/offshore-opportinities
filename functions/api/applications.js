)
      .run();

    return Response.json(
      {
        success: true,
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
