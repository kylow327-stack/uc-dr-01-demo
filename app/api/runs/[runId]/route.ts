import { getRun } from "@/lib/store";
import { errorResponse, json } from "@/lib/http";
import { responseFor } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await context.params;
    const run = getRun(runId);
    if (!run) return json({ error: "Run not found on this server instance." }, 404);
    return json(responseFor(run));
  } catch (error) {
    return errorResponse(error);
  }
}
