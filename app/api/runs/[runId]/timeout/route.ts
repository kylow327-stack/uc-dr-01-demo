import { errorResponse, json } from "@/lib/http";
import { timeoutRun } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: { params: Promise<{ runId: string }> },
): Promise<Response> {
  try {
    const { runId } = await context.params;
    return json(timeoutRun(runId));
  } catch (error) {
    return errorResponse(error);
  }
}
