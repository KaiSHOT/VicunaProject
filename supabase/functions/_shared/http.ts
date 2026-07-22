import { corsHeaders } from "./cors.ts";

export function respond(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function fail(status: number, code: string, message: string): Response {
  return respond(status, { error: { code, message } });
}
