import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { RESERVED_CASE_IDS, parsePastedCase } from "@/lib/case-parse";
import { loadCases } from "@/lib/fixtures";
import { pasteTemplateCase } from "@/lib/paste-template";
import { startPastedRun, startRun, stepRun, timeoutRun } from "@/lib/run-context";
import type { CaseFixture } from "@/lib/types";

function cloneTemplate(): CaseFixture {
  return structuredClone(pasteTemplateCase());
}

describe("pasted case portal", () => {
  it("keeps the example template off the three reserved demo ids", () => {
    const template = pasteTemplateCase();
    const parsed = parsePastedCase(template);
    assert.equal(parsed.ok, true);
    if (!parsed.ok) return;
    assert.equal(parsed.value.caseId, "CASE-PASTE");
    assert.equal(parsed.value.folderPath, "cases/allow/CASE-PASTE-sample");
    assert.deepEqual(
      [...RESERVED_CASE_IDS].sort(),
      loadCases()
        .map((item) => item.caseId)
        .sort(),
    );
  });

  it("reports field errors and refuses a built-in case id", () => {
    const reserved = parsePastedCase({ ...cloneTemplate(), caseId: "CASE-2041" });
    assert.equal(reserved.ok, false);
    if (reserved.ok) return;
    assert.ok(reserved.errors.some((error) => error.path === "caseId"));

    const broken = cloneTemplate();
    broken.documents[0].fields[0].confidence = "high" as unknown as number;
    broken.folderPath = "outside/the-allow-list";
    const parsed = parsePastedCase(broken);
    assert.equal(parsed.ok, false);
    if (parsed.ok) return;
    assert.ok(parsed.errors.some((error) => error.path === "documents[0].fields[0].confidence"));
    assert.ok(parsed.errors.some((error) => error.path === "folderPath"));

    const sparse = parsePastedCase({ caseId: "CASE-NEW" });
    assert.equal(sparse.ok, false);
    if (sparse.ok) return;
    assert.ok(sparse.errors.some((error) => error.path === "documents"));
    assert.ok(sparse.errors.some((error) => error.path === "title"));
  });

  it("runs the template to a non-clearing soft packet with a fixture_fallback briefing", async () => {
    const started = startPastedRun(pasteTemplateCase());
    assert.equal(started.folder.caseId, "CASE-PASTE");
    const played = await stepRun(started.run.runId, "play");
    assert.equal(played.run.phase, "soft_written");
    assert.equal(played.run.score?.tier, "low");
    assert.equal(played.run.score?.route, "soft");
    assert.equal(played.run.score?.tierSource, "policy_table");
    assert.equal(played.run.narrative?.source, "fixture_fallback");
    assert.ok((played.run.narrative?.factors.length ?? 0) >= 2);
    assert.equal(played.run.packet?.disposition, "non_clearing_soft_flag");
    assert.equal(played.run.packet?.clearsRegulatoryObligation, false);
    assert.equal(JSON.stringify(played.run).includes('"approved":true'), false);

    const board = startRun("CASE-2041");
    assert.equal(board.folder.title, "Sample retail onboarding");
  });

  it("builds a grounded briefing from the extract when the pasted narrative does not cite", async () => {
    const bare = cloneTemplate();
    bare.caseId = "CASE-PASTE-BARE";
    bare.folderPath = "cases/allow/CASE-PASTE-BARE";
    bare.fixtureNarrative = {
      summary: "Uncited briefing.",
      factors: [{ id: "RF-X", text: "No usable cite.", citations: ["nope"] }],
    };
    const played = await stepRun(startPastedRun(bare).run.runId, "play");
    assert.equal(played.run.narrative?.source, "fixture_fallback");
    assert.match(played.run.narrative?.note ?? "", /extract and the gaps/);
    assert.ok(
      played.run.narrative?.factors.some((factor) =>
        factor.citations.some((cite) => cite.startsWith("cite:CASE-PASTE-BARE:")),
      ),
    );
    assert.equal(played.run.score?.tierSource, "policy_table");
  });

  it("stops a pasted gap pack at HITL and quarantines a timeout without approving", async () => {
    const gap = cloneTemplate();
    gap.caseId = "CASE-PASTE-GAP";
    gap.folderPath = "cases/allow/CASE-PASTE-GAP";
    gap.documents = gap.documents.filter((doc) => doc.classifiedType !== "proof_of_address");
    const played = await stepRun(startPastedRun(gap).run.runId, "play");
    assert.equal(played.run.phase, "hitl_waiting");
    assert.equal(played.run.score?.tier, "medium");
    assert.equal(played.run.score?.route, "hitl");
    assert.equal(played.run.packet, null);
    const timed = timeoutRun(played.run.runId);
    assert.equal(timed.run.phase, "quarantine");
    assert.equal(timed.run.quarantine?.approved, false);
    assert.equal(timed.run.packet, null);
    assert.equal(JSON.stringify(timed.run).includes('"approved":true'), false);
  });
});
