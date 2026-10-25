import { allowedCitations, fieldCitation, groundNarrative } from "@/lib/graph/citations";
import { checkCompleteness, intakeAllows, isKnownType } from "@/lib/graph/completeness";
import { scoreCase } from "@/lib/policy/score";
import type {
  BreakerState,
  CaseFixture,
  CompletenessResult,
  Narrative,
  NodeRecord,
  PackV1,
  RunPhase,
  RunState,
  ScoreResult,
  SorDisposition,
  SorPacket,
} from "@/lib/types";

export class EngineError extends Error {
  readonly status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.status = status;
  }
}

export interface SummarizeInput {
  caseFile: CaseFixture;
  completeness: CompletenessResult;
  allowedCitations: string[];
  suppressLlm: boolean;
}

export type Summarizer = (input: SummarizeInput) => Promise<Narrative>;

export interface GraphContext {
  caseFile: CaseFixture;
  pack: PackV1;
  taxonomyIds: readonly string[];
  breakers: Array<{ id: string; state: BreakerState }>;
  summarize: Summarizer;
  now?: () => string;
}

const TERMINAL: ReadonlySet<RunPhase> = new Set([
  "soft_written",
  "packet_written",
  "rejected",
  "escalated",
  "quarantine",
  "killed",
  "frozen",
]);

function stamp(ctx: GraphContext): string {
  return (ctx.now ?? (() => new Date().toISOString()))();
}

function breakerState(ctx: GraphContext, id: string): BreakerState {
  return ctx.breakers.find((breaker) => breaker.id === id)?.state ?? "closed";
}

function openBreakerIds(ctx: GraphContext): string[] {
  return ctx.breakers.filter((breaker) => breaker.state === "open").map((breaker) => breaker.id);
}

export function createRun(caseId: string, runId: string, now = new Date().toISOString()): RunState {
  return {
    runId,
    caseId,
    traceId: `lf-demo-${runId}`,
    createdAt: now,
    updatedAt: now,
    stepIndex: 0,
    phase: "ready",
    nodes: [],
    completeness: null,
    narrative: null,
    score: null,
    hitl: { action: null, note: null, at: null, analystAcceptedPacket: false },
    packet: null,
    quarantine: null,
    securityBridge: null,
    freeze: null,
    revision: 0,
  };
}

function touch(run: RunState, ctx: GraphContext, patch: Partial<RunState>): RunState {
  return { ...run, ...patch, updatedAt: stamp(ctx), revision: run.revision + 1 };
}

function upsertNode(nodes: NodeRecord[], node: NodeRecord): NodeRecord[] {
  const index = nodes.findIndex((item) => item.nodeId === node.nodeId);
  if (index === -1) return [...nodes, node];
  const copy = nodes.slice();
  copy[index] = node;
  return copy;
}

function killForEgress(run: RunState, ctx: GraphContext): RunState {
  const at = stamp(ctx);
  const reason = "CB-DATA-EGRESS is open. Run killed. Security incident bridge opened (simulated). No SoR write.";
  const node: NodeRecord = {
    nodeId: "egress_kill",
    controls: ["CP-NET", "CB-DATA-EGRESS"],
    status: "killed",
    title: "Egress kill",
    detail: reason,
    payload: { kind: "killed", reason },
    at,
  };
  return touch(run, ctx, {
    phase: "killed",
    nodes: upsertNode(run.nodes, node),
    securityBridge: { opened: true, reason, at },
    packet: null,
  });
}

function policyScore(run: RunState): ScoreResult {
  if (!run.score || run.score.tierSource !== "policy_table") {
    throw new EngineError("A packet requires a tier from the policy table.", 409);
  }
  return run.score;
}

function buildPacket(run: RunState, ctx: GraphContext, disposition: SorDisposition): SorPacket {
  const score = policyScore(run);
  return {
    packetId: `pkt_${run.caseId}_${run.runId}`,
    auditId: `aud_${run.runId.replace(/^run_/, "")}`,
    caseId: run.caseId,
    runId: run.runId,
    disposition,
    clearsRegulatoryObligation: false,
    tier: score.tier,
    policyRowIds: score.policyRowIds,
    tierSource: "policy_table",
    narrative: run.narrative,
    analystNote: run.hitl.note,
    traceId: run.traceId,
    writtenAt: stamp(ctx),
    idempotent: true,
    label: "Non-clearing flag. This packet does not clear a regulatory obligation.",
  };
}

function writeNodes(run: RunState, ctx: GraphContext, packet: SorPacket): NodeRecord[] {
  const at = stamp(ctx);
  const write: NodeRecord = {
    nodeId: "write_case_packet",
    controls: ["CP-CASE"],
    status: "passed",
    title: "Simulated SoR write",
    detail: `${packet.disposition}. Idempotent packet ${packet.packetId}. clearsRegulatoryObligation is false.`,
    payload: { kind: "write", packetId: packet.packetId, disposition: packet.disposition },
    at,
  };
  const evalNode: NodeRecord = {
    nodeId: "emit_langfuse_eval",
    controls: ["CP-EVAL"],
    status: "passed",
    title: "Simulated trace",
    detail: `Trace ${run.traceId} attached. This is not a live Langfuse project.`,
    payload: { kind: "eval", traceId: run.traceId },
    at,
  };
  return upsertNode(upsertNode(run.nodes, write), evalNode);
}

async function advanceOne(run: RunState, ctx: GraphContext): Promise<{ run: RunState; advanced: boolean }> {
  if (TERMINAL.has(run.phase)) return { run, advanced: false };
  if (breakerState(ctx, "CB-DATA-EGRESS") === "open") {
    return { run: killForEgress(run, ctx), advanced: true };
  }

  const at = stamp(ctx);
  const step = run.stepIndex;

  if (step === 0) {
    const accepted = intakeAllows(ctx.caseFile.folderPath, ctx.pack.allowPrefix);
    const node: NodeRecord = {
      nodeId: "intake_folder",
      controls: ["CP-INTAKE"],
      status: accepted ? "passed" : "failed",
      title: "Intake folder",
      detail: accepted
        ? `Folder ${ctx.caseFile.folderPath} is inside the v1 allow-list. Named folders only.`
        : `Folder ${ctx.caseFile.folderPath} is outside ${ctx.pack.allowPrefix}. Run rejected.`,
      payload: {
        kind: "intake",
        folderPath: ctx.caseFile.folderPath,
        allowPrefix: ctx.pack.allowPrefix,
        accepted,
      },
      at,
    };
    if (!accepted) {
      return {
        run: touch(run, ctx, { phase: "rejected", nodes: upsertNode(run.nodes, node) }),
        advanced: true,
      };
    }
    return {
      run: touch(run, ctx, {
        phase: "in_progress",
        stepIndex: 1,
        nodes: upsertNode(run.nodes, node),
      }),
      advanced: true,
    };
  }

  if (step === 1) {
    const documents = ctx.caseFile.documents.map((doc) => ({
      docId: doc.docId,
      fileName: doc.fileName,
      classifiedType: doc.classifiedType,
      inTaxonomy: isKnownType(doc.classifiedType) && ctx.taxonomyIds.includes(doc.classifiedType),
    }));
    const unknown = documents.filter((doc) => !doc.inTaxonomy);
    const node: NodeRecord = {
      nodeId: "classify_doc_type",
      controls: ["CP-CLS"],
      status: unknown.length > 0 ? "attention" : "passed",
      title: "Classify document type",
      detail:
        unknown.length > 0
          ? `${unknown.length} file(s) are outside TAX-v1. They will force HITL at CP-SCORE.`
          : "Every file maps to the frozen taxonomy.",
      payload: { kind: "classify", documents },
      at,
    };
    return {
      run: touch(run, ctx, { phase: "in_progress", stepIndex: 2, nodes: upsertNode(run.nodes, node) }),
      advanced: true,
    };
  }

  if (step === 2) {
    if (breakerState(ctx, "CB-EXTRACT") === "open") {
      const already = run.nodes.find((node) => node.nodeId === "extract_fields" && node.status === "paused");
      if (already && run.phase === "paused") return { run, advanced: false };
      const node: NodeRecord = {
        nodeId: "extract_fields",
        controls: ["CP-EXT", "CB-EXTRACT"],
        status: "paused",
        title: "Extract paused",
        detail: "CB-EXTRACT is open. Extract is paused and files stay queued. Close the breaker and step again. Nothing is approved.",
        payload: {
          kind: "extract",
          confidenceFloor: ctx.pack.confidenceFloor,
          lowConfidenceShare: 0,
          documents: [],
        },
        at,
      };
      return {
        run: touch(run, ctx, { phase: "paused", nodes: upsertNode(run.nodes, node) }),
        advanced: true,
      };
    }

    const completenessPreview = checkCompleteness(ctx.caseFile, ctx.pack, ctx.taxonomyIds);
    const documents = ctx.caseFile.documents.map((doc) => ({
      docId: doc.docId,
      fileName: doc.fileName,
      classifiedType: doc.classifiedType,
      fields: doc.fields.map((field) => ({
        citationId: fieldCitation(ctx.caseFile.caseId, doc.docId, field.id),
        label: field.label,
        value: field.value,
        confidence: field.confidence,
        page: field.page,
        belowFloor: field.confidence < ctx.pack.confidenceFloor,
      })),
    }));
    const below = documents.reduce(
      (count, doc) => count + doc.fields.filter((field) => field.belowFloor).length,
      0,
    );
    const node: NodeRecord = {
      nodeId: "extract_fields",
      controls: ["CP-EXT"],
      status: below > 0 ? "attention" : "passed",
      title: "Extract fields",
      detail:
        below > 0
          ? `${below} field(s) are below ${ctx.pack.confidenceFloor.toFixed(2)}. CP-EXT will force HITL. Pack low-confidence share is ${(completenessPreview.lowConfidenceShare * 100).toFixed(0)}% (CB-CONFIDENCE trip illustration is above 25%).`
          : `Required fields are at or above ${ctx.pack.confidenceFloor.toFixed(2)}.`,
      payload: {
        kind: "extract",
        confidenceFloor: ctx.pack.confidenceFloor,
        lowConfidenceShare: completenessPreview.lowConfidenceShare,
        documents,
      },
      at,
    };
    return {
      run: touch(run, ctx, { phase: "in_progress", stepIndex: 3, nodes: upsertNode(run.nodes, node) }),
      advanced: true,
    };
  }

  if (step === 3) {
    const result = checkCompleteness(ctx.caseFile, ctx.pack, ctx.taxonomyIds);
    const node: NodeRecord = {
      nodeId: "completeness_check",
      controls: ["CP-GAP", "CP-HOOK"],
      status: result.complete ? "passed" : "attention",
      title: "Completeness check",
      detail: result.complete
        ? `${ctx.pack.packId} ${result.profile} checklist matched. Rules were read from the pack file, not from a prompt.`
        : `${result.gaps.length} gap(s) against ${ctx.pack.packId}. The checklist is data, outside the model.`,
      payload: { kind: "completeness", result },
      at,
    };
    return {
      run: touch(run, ctx, {
        phase: "in_progress",
        stepIndex: 4,
        completeness: result,
        nodes: upsertNode(run.nodes, node),
      }),
      advanced: true,
    };
  }

  if (step === 4) {
    const completeness = run.completeness ?? checkCompleteness(ctx.caseFile, ctx.pack, ctx.taxonomyIds);
    const allow = allowedCitations(ctx.caseFile, completeness);
    const suppressLlm = breakerState(ctx, "CB-LLM") === "open";
    const narrative = suppressLlm
      ? {
          summary: "Narrative suppressed. CB-LLM is open, so this packet goes to HITL without a model briefing.",
          factors: [],
          source: "suppressed" as const,
          droppedUncited: 0,
          note: "CB-LLM degrade: stop the summarize node.",
        }
      : await ctx.summarize({
          caseFile: ctx.caseFile,
          completeness,
          allowedCitations: allow,
          suppressLlm: false,
        });
    const node: NodeRecord = {
      nodeId: "risk_summarize",
      controls: ["CP-LLM"],
      status: narrative.source === "suppressed" ? "attention" : "passed",
      title: "Grounded summary",
      detail:
        narrative.source === "suppressed"
          ? "CB-LLM is open. No narrative was drafted. Tier is still unset here."
          : `Source: ${narrative.source}. ${narrative.factors.length} grounded factor(s). ${narrative.droppedUncited} dropped. This node does not set the tier.`,
      payload: { kind: "summary", narrative },
      at,
    };
    return {
      run: touch(run, ctx, {
        phase: "in_progress",
        stepIndex: 5,
        narrative,
        completeness,
        nodes: upsertNode(run.nodes, node),
      }),
      advanced: true,
    };
  }

  if (step === 5) {
    const completeness = run.completeness ?? checkCompleteness(ctx.caseFile, ctx.pack, ctx.taxonomyIds);
    const score = scoreCase({
      unknownTypeCount: completeness.unknownTypes.length,
      lowConfidenceCount: completeness.lowConfidenceFields.length,
      identityConflict: ctx.caseFile.identityConflict,
      elevatedIndicators: ctx.caseFile.elevatedIndicators,
      complete: completeness.complete,
      breakers: ctx.breakers,
    });
    const node: NodeRecord = {
      nodeId: "score_and_route",
      controls: ["CP-SCORE"],
      status: "passed",
      title: "Score and route",
      detail: `Tier ${score.tier} from ${score.policyRowIds.join(", ") || "policy table"}. Route ${score.route}. Narrative was not an input.`,
      payload: { kind: "score", score },
      at,
    };
    return {
      run: touch(run, ctx, {
        phase: "in_progress",
        stepIndex: 6,
        score,
        nodes: upsertNode(run.nodes, node),
      }),
      advanced: true,
    };
  }

  if (step === 6) {
    const completeness = run.completeness ?? checkCompleteness(ctx.caseFile, ctx.pack, ctx.taxonomyIds);
    const score = scoreCase({
      unknownTypeCount: completeness.unknownTypes.length,
      lowConfidenceCount: completeness.lowConfidenceFields.length,
      identityConflict: ctx.caseFile.identityConflict,
      elevatedIndicators: ctx.caseFile.elevatedIndicators,
      complete: completeness.complete,
      breakers: ctx.breakers,
    });
    const scoreNode: NodeRecord = {
      nodeId: "score_and_route",
      controls: ["CP-SCORE"],
      status: "passed",
      title: "Score and route",
      detail: `Tier ${score.tier} from ${score.policyRowIds.join(", ") || "policy table"}. Route ${score.route}. Narrative was not an input.`,
      payload: { kind: "score", score },
      at,
    };

    if (score.route === "soft") {
      const packet = buildPacket({ ...run, score }, ctx, "non_clearing_soft_flag");
      const soft: NodeRecord = {
        nodeId: "auto_flag_soft",
        controls: ["CP-SCORE", "CP-CASE"],
        status: "passed",
        title: "Soft flag",
        detail: "Low and complete, every breaker closed. Non-clearing flag only. The regulatory obligation is unchanged.",
        payload: { kind: "soft", packetId: packet.packetId },
        at,
      };
      const withSoft = {
        ...run,
        score,
        nodes: upsertNode(upsertNode(run.nodes, scoreNode), soft),
        narrative: run.narrative,
      };
      return {
        run: touch(withSoft, ctx, {
          phase: "soft_written",
          stepIndex: 7,
          score,
          packet,
          nodes: writeNodes(withSoft, ctx, packet),
        }),
        advanced: true,
      };
    }

    const node: NodeRecord = {
      nodeId: "hitl_interrupt",
      controls: ["CP-HITL"],
      status: "waiting",
      title: "HITL interrupt",
      detail: "Waiting for approve, edit, reject, or escalate. Timeout quarantines and does not approve.",
      payload: { kind: "hitl", reasons: score.reasons },
      at,
    };
    return {
      run: touch(run, ctx, {
        phase: "hitl_waiting",
        stepIndex: 7,
        score,
        nodes: upsertNode(upsertNode(run.nodes, scoreNode), node),
      }),
      advanced: true,
    };
  }

  return { run, advanced: false };
}

export async function advanceRun(
  run: RunState,
  ctx: GraphContext,
  mode: "step" | "play",
): Promise<{ run: RunState; advanced: boolean }> {
  let current = run;
  let advancedAny = false;
  const limit = mode === "play" ? 8 : 1;
  for (let i = 0; i < limit; i += 1) {
    if (TERMINAL.has(current.phase)) break;
    const next = await advanceOne(current, ctx);
    if (!next.advanced) break;
    current = next.run;
    advancedAny = true;
    if (mode === "step") break;
    if (current.phase === "paused" || current.phase === "hitl_waiting" || TERMINAL.has(current.phase)) break;
  }
  return { run: current, advanced: advancedAny };
}

function assertWaiting(run: RunState): void {
  if (run.phase !== "hitl_waiting" && run.phase !== "edited") {
    throw new EngineError("HITL actions are only available while the run is waiting at the interrupt.", 409);
  }
  if (run.quarantine) {
    throw new EngineError("This run is in quarantine. Timeout is not an approval, and it cannot be overwritten.", 409);
  }
}

export function applyHitl(
  run: RunState,
  ctx: GraphContext,
  action: "approve" | "edit" | "reject" | "escalate",
  note: string | null,
): RunState {
  if (run.phase === "packet_written" || run.phase === "soft_written") {
    if (action === "approve" && run.packet) return run;
    throw new EngineError("A packet is already on this run. The write is idempotent and was not repeated as a new decision.", 409);
  }
  assertWaiting(run);
  const trimmed = note?.trim() ? note.trim().slice(0, 1000) : null;
  const at = stamp(ctx);

  if (breakerState(ctx, "CB-DATA-EGRESS") === "open" && action === "approve") {
    return killForEgress(run, ctx);
  }

  if (action === "edit") {
    return touch(run, ctx, {
      phase: "edited",
      hitl: { action: "edit", note: trimmed, at, analystAcceptedPacket: false },
    });
  }

  if (action === "reject") {
    const node: NodeRecord = {
      nodeId: "hitl_interrupt",
      controls: ["CP-HITL"],
      status: "passed",
      title: "HITL rejected",
      detail: "Analyst rejected the packet. No SoR flag was written. The obligation is unchanged.",
      payload: { kind: "hitl", reasons: run.score?.reasons ?? [] },
      at,
    };
    return touch(run, ctx, {
      phase: "rejected",
      hitl: { action: "reject", note: trimmed, at, analystAcceptedPacket: false },
      packet: null,
      nodes: upsertNode(run.nodes, node),
    });
  }

  if (action === "escalate") {
    const node: NodeRecord = {
      nodeId: "hitl_interrupt",
      controls: ["CP-HITL"],
      status: "passed",
      title: "Escalated",
      detail: "Escalated to the Risk Ops lead queue (simulated). Not written. Not an approval.",
      payload: { kind: "hitl", reasons: run.score?.reasons ?? [] },
      at,
    };
    return touch(run, ctx, {
      phase: "escalated",
      hitl: { action: "escalate", note: trimmed, at, analystAcceptedPacket: false },
      packet: null,
      nodes: upsertNode(run.nodes, node),
    });
  }

  if (breakerState(ctx, "CB-CASE-WRITE") === "open") {
    const reason = "CB-CASE-WRITE is open. Completions are frozen. The packet was not written and the case was not approved.";
    const node: NodeRecord = {
      nodeId: "write_case_packet",
      controls: ["CP-CASE", "CB-CASE-WRITE"],
      status: "paused",
      title: "Write frozen",
      detail: reason,
      payload: { kind: "frozen", reason },
      at,
    };
    return touch(run, ctx, {
      phase: "frozen",
      freeze: { at, reason, written: false },
      packet: null,
      hitl: { action: "approve", note: trimmed ?? run.hitl.note, at, analystAcceptedPacket: false },
      nodes: upsertNode(run.nodes, node),
    });
  }

  const accepted: NodeRecord = {
    nodeId: "hitl_interrupt",
    controls: ["CP-HITL"],
    status: "passed",
    title: "Analyst accepted the packet",
    detail: "Analyst acceptance records the flag packet. It does not clear a regulatory obligation.",
    payload: { kind: "hitl", reasons: run.score?.reasons ?? [] },
    at,
  };
  const withNote: RunState = {
    ...run,
    nodes: upsertNode(run.nodes, accepted),
    hitl: { action: "approve", note: trimmed ?? run.hitl.note, at, analystAcceptedPacket: true },
  };
  const packet = buildPacket(withNote, ctx, "analyst_accepted_packet");
  return touch(withNote, ctx, {
    phase: "packet_written",
    packet,
    nodes: writeNodes(withNote, ctx, packet),
  });
}

export function applyTimeout(run: RunState, ctx: GraphContext): RunState {
  assertWaiting(run);
  const at = stamp(ctx);
  const reason = "Analyst timeout. The case is in quarantine. This is not an approval and no soft flag was written.";
  const node: NodeRecord = {
    nodeId: "hitl_interrupt",
    controls: ["CP-HITL"],
    status: "attention",
    title: "Quarantine",
    detail: reason,
    payload: { kind: "hitl", reasons: [reason] },
    at,
  };
  return touch(run, ctx, {
    phase: "quarantine",
    quarantine: { at, reason, approved: false },
    packet: null,
    hitl: { action: "timeout", note: run.hitl.note, at, analystAcceptedPacket: false },
    nodes: upsertNode(run.nodes, node),
  });
}

export function fixtureSummarizer(input: SummarizeInput): Promise<Narrative> {
  if (input.suppressLlm) {
    return Promise.resolve({
      summary: "Narrative suppressed.",
      factors: [],
      source: "suppressed",
      droppedUncited: 0,
      note: null,
    });
  }
  return Promise.resolve(
    groundNarrative(input.caseFile.fixtureNarrative, input.allowedCitations, "fixture"),
  );
}

export function openIds(ctx: GraphContext): string[] {
  return openBreakerIds(ctx);
}
