import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadBreakerFile, loadCase, loadPack, loadTaxonomy } from "@/lib/fixtures";
import type { BreakerState, RunState } from "@/lib/types";
import {
  advanceRun,
  applyHitl,
  applyTimeout,
  createRun,
  fixtureSummarizer,
  EngineError,
  type GraphContext,
} from "@/lib/graph/engine";

function breakerMap(overrides: Record<string, BreakerState> = {}): GraphContext["breakers"] {
  return loadBreakerFile().breakers.map((breaker) => ({
    id: breaker.id,
    state: overrides[breaker.id] ?? breaker.defaultState,
  }));
}

function context(caseId: string, overrides: Partial<GraphContext> = {}): GraphContext {
  const caseFile = loadCase(caseId);
  if (!caseFile) throw new Error(`missing ${caseId}`);
  return {
    caseFile,
    pack: loadPack(),
    taxonomyIds: loadTaxonomy().entries.map((entry) => entry.id),
    breakers: breakerMap(),
    summarize: fixtureSummarizer,
    now: () => "2026-10-25T00:00:00.000Z",
    ...overrides,
  };
}

async function play(caseId: string, overrides: Partial<GraphContext> = {}): Promise<RunState> {
  const ctx = context(caseId, overrides);
  const started = createRun(caseId, `run_${caseId}`, "2026-10-25T00:00:00.000Z");
  const result = await advanceRun(started, ctx, "play");
  return result.run;
}

function assertNeverApproved(run: RunState): void {
  assert.equal(JSON.stringify(run).includes('"approved":true'), false);
}

describe("fixture runs", () => {
  it("writes a non-clearing soft flag for the low complete pack", async () => {
    const run = await play("CASE-2041");
    assert.equal(run.phase, "soft_written");
    assert.equal(run.score?.tier, "low");
    assert.equal(run.score?.route, "soft");
    assert.deepEqual(run.score?.policyRowIds, ["POL-06"]);
    assert.equal(run.narrative?.source, "fixture");
    assert.equal(run.narrative?.droppedUncited, 0);
    assert.ok(run.narrative && run.narrative.factors.length >= 2);
    assert.equal(run.packet?.disposition, "non_clearing_soft_flag");
    assert.equal(run.packet?.clearsRegulatoryObligation, false);
    assert.equal(run.packet?.tierSource, "policy_table");
    assert.equal(run.hitl.analystAcceptedPacket, false);
    const controls = new Set(run.nodes.flatMap((node) => node.controls));
    for (const id of ["CP-INTAKE", "CP-CLS", "CP-EXT", "CP-GAP", "CP-HOOK", "CP-LLM", "CP-SCORE", "CP-CASE", "CP-EVAL"]) {
      assert.equal(controls.has(id), true, id);
    }
    assertNeverApproved(run);
  });

  it("stops the gap pack at HITL with a medium tier", async () => {
    const run = await play("CASE-2077");
    assert.equal(run.phase, "hitl_waiting");
    assert.equal(run.score?.tier, "medium");
    assert.equal(run.score?.route, "hitl");
    assert.deepEqual(run.score?.policyRowIds, ["POL-05"]);
    assert.equal(run.packet, null);
    const gapIds = run.completeness?.gaps.map((gap) => gap.citationId) ?? [];
    assert.ok(gapIds.includes("gap:CASE-2077:missing_doc:proof_of_address"));
    assert.ok(gapIds.includes("gap:CASE-2077:missing_field:passport:expiry_date"));
    assert.equal(run.narrative?.droppedUncited, 0);
  });

  it("forces HITL at high tier for the confidence and conflict pack", async () => {
    const run = await play("CASE-2118");
    assert.equal(run.phase, "hitl_waiting");
    assert.equal(run.score?.tier, "high");
    assert.ok(run.score?.policyRowIds.includes("POL-02"));
    assert.ok(run.score?.policyRowIds.includes("POL-03"));
    assert.ok(run.score?.policyRowIds.includes("POL-04"));
    assert.equal(run.score?.policyRowIds.includes("POL-06"), false);
    assert.equal(run.completeness?.lowConfidenceFields.length, 1);
    assert.ok((run.completeness?.lowConfidenceShare ?? 1) < 0.25);
    assert.equal(run.packet, null);
    assert.equal(run.narrative?.droppedUncited, 0);
  });

  it("writes the policy-table tier when the stored score was replaced", async () => {
    const ctx = context("CASE-2077");
    const waiting = await play("CASE-2077");
    assert.equal(waiting.score?.tier, "medium");
    const forged = {
      ...waiting,
      score: waiting.score ? { ...waiting.score, tier: "low" as const } : null,
    };
    const accepted = applyHitl(forged, ctx, "approve", null);
    assert.equal(accepted.score?.tier, "medium");
    assert.equal(accepted.packet?.tier, "medium");
    assert.equal(accepted.packet?.tierSource, "policy_table");
    assert.ok(accepted.packet?.policyRowIds.includes("POL-05"));
    const missing = applyHitl({ ...waiting, score: null }, ctx, "approve", null);
    assert.equal(missing.packet?.tier, "medium");
    assert.equal(missing.packet?.tierSource, "policy_table");
  });

  it("quarantines a timeout and refuses a later approve", async () => {
    const ctx = context("CASE-2077");
    const waiting = await play("CASE-2077");
    const quarantined = applyTimeout(waiting, ctx);
    assert.equal(quarantined.phase, "quarantine");
    assert.equal(quarantined.quarantine?.approved, false);
    assert.equal(quarantined.packet, null);
    assert.equal(quarantined.hitl.analystAcceptedPacket, false);
    assertNeverApproved(quarantined);
    assert.throws(() => applyHitl(quarantined, ctx, "approve", null), EngineError);
  });

  it("keeps edit, reject, and escalate off the SoR until an explicit accept", async () => {
    const ctx = context("CASE-2077");
    const waiting = await play("CASE-2077");
    const edited = applyHitl(waiting, ctx, "edit", "Analyst note: ask for the missing proof of address.");
    assert.equal(edited.phase, "edited");
    assert.equal(edited.packet, null);
    assert.equal(edited.hitl.analystAcceptedPacket, false);

    const rejected = applyHitl(waiting, ctx, "reject", null);
    assert.equal(rejected.phase, "rejected");
    assert.equal(rejected.packet, null);

    const escalated = applyHitl(waiting, ctx, "escalate", null);
    assert.equal(escalated.phase, "escalated");
    assert.equal(escalated.packet, null);

    const accepted = applyHitl(edited, ctx, "approve", null);
    assert.equal(accepted.phase, "packet_written");
    assert.equal(accepted.packet?.disposition, "analyst_accepted_packet");
    assert.equal(accepted.packet?.clearsRegulatoryObligation, false);
    assert.match(accepted.packet?.analystNote ?? "", /proof of address/);
    const again = applyHitl(accepted, ctx, "approve", null);
    assert.equal(again.packet?.packetId, accepted.packet?.packetId);
  });

  it("disables the soft path when any breaker is open and freezes the write", async () => {
    const openWrite = breakerMap({ "CB-CASE-WRITE": "open" });
    const run = await play("CASE-2041", { breakers: openWrite });
    assert.equal(run.phase, "hitl_waiting");
    assert.equal(run.score?.tier, "low");
    assert.equal(run.score?.route, "hitl");
    assert.equal(run.packet, null);

    const frozen = applyHitl(run, context("CASE-2041", { breakers: openWrite }), "approve", null);
    assert.equal(frozen.phase, "frozen");
    assert.equal(frozen.packet, null);
    assert.equal(frozen.freeze?.written, false);
    assert.equal(frozen.hitl.analystAcceptedPacket, false);
    assertNeverApproved(frozen);
  });

  it("kills the run when egress is open", async () => {
    const run = await play("CASE-2041", { breakers: breakerMap({ "CB-DATA-EGRESS": "open" }) });
    assert.equal(run.phase, "killed");
    assert.equal(run.packet, null);
    assert.equal(run.securityBridge?.opened, true);
    assert.equal(run.nodes.some((node) => node.nodeId === "egress_kill"), true);
  });

  it("pauses extract while CB-EXTRACT is open, then finishes when it closes", async () => {
    const paused = await play("CASE-2041", { breakers: breakerMap({ "CB-EXTRACT": "open" }) });
    assert.equal(paused.phase, "paused");
    assert.equal(paused.packet, null);
    const resumed = await advanceRun(paused, context("CASE-2041"), "play");
    assert.equal(resumed.run.phase, "soft_written");
    assert.equal(resumed.run.packet?.clearsRegulatoryObligation, false);
  });

  it("rejects a folder outside the allow-list", async () => {
    const base = context("CASE-2041");
    const run = await play("CASE-2041", {
      caseFile: { ...base.caseFile, folderPath: "cases/allow/../estate" },
    });
    assert.equal(run.phase, "rejected");
    assert.equal(run.packet, null);
  });

  it("steps one node at a time through classify, extract, completeness, and summary", async () => {
    const ctx = context("CASE-2041");
    let run = createRun("CASE-2041", "run_step", "2026-10-25T00:00:00.000Z");
    const seen: string[] = [];
    for (let i = 0; i < 5; i += 1) {
      const next = await advanceRun(run, ctx, "step");
      assert.equal(next.advanced, true);
      run = next.run;
      const latest = run.nodes[run.nodes.length - 1];
      if (latest) seen.push(latest.nodeId);
    }
    assert.deepEqual(seen, [
      "intake_folder",
      "classify_doc_type",
      "extract_fields",
      "completeness_check",
      "risk_summarize",
    ]);
    assert.equal(run.score, null);
    assert.equal(run.packet, null);
  });
});
