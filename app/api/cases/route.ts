import { listCaseSummaries } from "@/lib/run-context";
import { json } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return json({ cases: listCaseSummaries() });
}
