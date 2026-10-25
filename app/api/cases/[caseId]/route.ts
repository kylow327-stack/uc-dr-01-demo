import { loadCase } from "@/lib/fixtures";
import { json } from "@/lib/http";
import { summarizeCase } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ caseId: string }> },
): Promise<Response> {
  const { caseId } = await context.params;
  const caseFile = loadCase(caseId);
  if (!caseFile) return json({ error: `Unknown case folder ${caseId}` }, 404);
  return json({ folder: summarizeCase(caseFile) });
}
