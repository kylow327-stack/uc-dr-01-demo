import { json } from "@/lib/http";
import { pasteTemplateCase } from "@/lib/paste-template";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export function GET(): Response {
  return json({ template: pasteTemplateCase() });
}
