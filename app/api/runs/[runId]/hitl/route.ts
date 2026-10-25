import { errorResponse, json } from "@/lib/http";
import { decideRun } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ACTIONS = new Set(["approve", "edit", "reject", "escalate"]);

export async function POST(
  request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await context.params;
    const body = (await request.json()) as { action?: unknown; note?: unknown };
    if (typeof body.action !== "string" || !ACTIONS.has(body.action)) {
      return json({ error: "Action must be approve, edit, reject, or escalate." }, 400);
    }
    const note = typeof body.note === "string" ? body.note : null;
    return json(decideRun(runId, body.action as "approve" | "edit" | "reject" | "escalate", note));
  } catch (error) {
    return errorResponse(error);
  }
}
