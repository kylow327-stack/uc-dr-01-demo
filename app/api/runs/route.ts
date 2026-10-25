import { errorResponse, json } from "@/lib/http";
import { startRun } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    const body = (await request.json()) as { caseId?: unknown };
    if (typeof body.caseId !== "string" || body.caseId.trim() === "") {
      return json({ error: "caseId is required." }, 400);
    }
    return json(startRun(body.caseId));
  } catch (error) {
    return errorResponse(error);
  }
}
