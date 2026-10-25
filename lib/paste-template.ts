import { loadCase } from "@/lib/fixtures";
import type { CaseFixture } from "@/lib/types";

const TEMPLATE_ID = "CASE-PASTE";

/** CASE-2041-shaped pack with its own id, so the three board folders stay untouched. */
export function pasteTemplateCase(): CaseFixture {
  const source = loadCase("CASE-2041");
  if (!source) throw new Error("CASE-2041 fixture is missing");
  const cloned = JSON.parse(JSON.stringify(source).split("CASE-2041").join(TEMPLATE_ID)) as CaseFixture;
  cloned.caseId = TEMPLATE_ID;
  cloned.folderPath = "cases/allow/CASE-PASTE-sample";
  cloned.title = "Pasted sample pack";
  cloned.demoScript = "Paste · shaped like the low complete pack";
  cloned.blurb =
    "Editable copy of the fictional low complete pack. Change the JSON, then run it. The policy table still sets the tier.";
  return cloned;
}
