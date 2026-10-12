// Retired endpoint: no database operations are available over HTTP.
export function GET() { return Response.json({ error: "Endpoint removed" }, { status: 410 }); }
