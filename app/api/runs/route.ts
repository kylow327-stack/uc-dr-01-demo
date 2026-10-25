import { errorResponse, json } from "@/lib/http";
import { startFromRequest } from "@/lib/run-context";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  try {
    return json(startFromRequest(await request.json()));
  } catch (error) {
    return errorResponse(error);
  }
}
