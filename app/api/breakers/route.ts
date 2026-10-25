import { llmMode } from "@/lib/graph/summarize";
import { json } from "@/lib/http";
import { isBreakerState } from "@/lib/run-context";
import { breakerCaption, listBreakerViews, resetBreakers, setBreakerState, softAutoPathEnabled } from "@/lib/store";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function payload(): unknown {
  return {
    caption: breakerCaption(),
    softAutoPathEnabled: softAutoPathEnabled(),
    llmMode: llmMode(),
    breakers: listBreakerViews(),
  };
}

export function GET(): Response {
  return json(payload());
}

export async function PATCH(request: Request): Promise<Response> {
  const body = (await request.json()) as { id?: unknown; state?: unknown; reset?: unknown };
  if (body.reset === true) {
    resetBreakers();
    return json(payload());
  }
  if (typeof body.id !== "string" || !isBreakerState(body.state)) {
    return json({ error: "Expected { id, state } or { reset: true }." }, 400);
  }
  try {
    setBreakerState(body.id, body.state);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown breaker";
    return json({ error: message }, 400);
  }
  return json(payload());
}

export async function PUT(request: Request): Promise<Response> {
  const body = (await request.json()) as unknown;
  if (!Array.isArray(body)) return json({ error: "Expected an array of { id, state }." }, 400);
  for (const item of body) {
    if (typeof item !== "object" || item === null) continue;
    const row = item as { id?: unknown; state?: unknown };
    if (typeof row.id !== "string" || !isBreakerState(row.state)) continue;
    try {
      setBreakerState(row.id, row.state);
    } catch {
      continue;
    }
  }
  return json(payload());
}
