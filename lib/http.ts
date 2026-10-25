import { CaseValidationError } from "@/lib/case-parse";
import { EngineError } from "@/lib/graph/engine";

export function json(data: unknown, status = 200): Response {
  return Response.json(data, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

export function errorResponse(error: unknown): Response {
  if (error instanceof CaseValidationError) return json({ error: error.message, fields: error.fields }, 400);
  if (error instanceof EngineError) return json({ error: error.message }, error.status);
  const message = error instanceof Error ? error.message : "Request failed";
  const status = /unknown case/i.test(message) ? 404 : 400;
  return json({ error: message }, status);
}
