import { errorResponse, json } from "@/lib/http";
import { restoreRun } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    return json(restoreRun(await request.json()));
  } catch (error) {
    return errorResponse(error);
  }
}
