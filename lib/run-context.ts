import { randomUUID } from "crypto";
import { loadCase, loadCases, loadPack, loadTaxonomy } from "@/lib/fixtures";
import { advanceRun, applyHitl, applyTimeout, createRun, EngineError, type GraphContext } from "@/lib/graph/engine";
import { buildNarrative, llmMode } from "@/lib/graph/summarize";
import type { CaseSummary, RunResponse } from "@/lib/dto";
import { getRun, listBreakerViews, saveRun } from "@/lib/store";
import type { BreakerState, CaseFixture, RunPhase, RunState } from "@/lib/types";

const PHASES = new Set<RunPhase>([
  "ready",
  "in_progress",
  "paused",
  "hitl_waiting",
  "edited",
  "soft_written",
  "packet_written",
  "frozen",
  "rejected",
  "escalated",
  "quarantine",
  "killed",
]);

export function summarizeCase(caseFile: CaseFixture): CaseSummary {
  return {
    caseId: caseFile.caseId,
    title: caseFile.title,
    demoScript: caseFile.demoScript,
    subjectLabel: caseFile.subjectLabel,
    blurb: caseFile.blurb,
    folderPath: caseFile.folderPath,
    profile: caseFile.profile,
    documents: caseFile.documents.map((doc) => ({
      docId: doc.docId,
      fileName: doc.fileName,
      classifiedType: doc.classifiedType,
    })),
  };
}

const BOARD_ORDER = ["CASE-2041", "CASE-2077", "CASE-2118"];

export function listCaseSummaries(): CaseSummary[] {
  return loadCases()
    .slice()
    .sort((a, b) => BOARD_ORDER.indexOf(a.caseId) - BOARD_ORDER.indexOf(b.caseId))
    .map(summarizeCase);
}

function contextFor(caseId: string): GraphContext {
  const caseFile = loadCase(caseId);
  if (!caseFile) throw new EngineError(`Unknown case folder ${caseId}`, 404);
  return {
    caseFile,
    pack: loadPack(),
    taxonomyIds: loadTaxonomy().entries.map((entry) => entry.id),
    breakers: listBreakerViews().map((breaker) => ({ id: breaker.id, state: breaker.state })),
    summarize: buildNarrative,
  };
}

export function responseFor(run: RunState, advanced?: boolean): RunResponse {
  const caseFile = loadCase(run.caseId);
  if (!caseFile) throw new EngineError(`Unknown case folder ${run.caseId}`, 404);
  return { run, folder: summarizeCase(caseFile), advanced };
}

export function startRun(caseId: string): RunResponse {
  const ctx = contextFor(caseId);
  const run = saveRun(createRun(caseId, `run_${randomUUID()}`));
  return responseFor(run);
}

export async function stepRun(runId: string, mode: "step" | "play"): Promise<RunResponse> {
  const existing = getRun(runId);
  if (!existing) throw new EngineError("Run not found on this server instance.", 404);
  const ctx = contextFor(existing.caseId);
  const result = await advanceRun(existing, ctx, mode);
  return responseFor(saveRun(result.run), result.advanced);
}

export function decideRun(
  runId: string,
  action: "approve" | "edit" | "reject" | "escalate",
  note: string | null,
): RunResponse {
  const existing = getRun(runId);
  if (!existing) throw new EngineError("Run not found on this server instance.", 404);
  const next = applyHitl(existing, contextFor(existing.caseId), action, note);
  return responseFor(saveRun(next));
}

export function timeoutRun(runId: string): RunResponse {
  const existing = getRun(runId);
  if (!existing) throw new EngineError("Run not found on this server instance.", 404);
  const next = applyTimeout(existing, contextFor(existing.caseId));
  return responseFor(saveRun(next));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function restoreRun(value: unknown): RunResponse {
  if (!isRecord(value)) throw new EngineError("Run state is not an object.");
  const runId = value.runId;
  const caseId = value.caseId;
  const phase = value.phase;
  if (typeof runId !== "string" || typeof caseId !== "string") {
    throw new EngineError("Run state is missing runId or caseId.");
  }
  if (typeof phase !== "string" || !PHASES.has(phase as RunPhase)) {
    throw new EngineError("Run state has an unknown phase.");
  }
  if (!Array.isArray(value.nodes) || !isRecord(value.hitl)) {
    throw new EngineError("Run state is missing nodes or the HITL record.");
  }
  if (!loadCase(caseId)) throw new EngineError(`Unknown case folder ${caseId}`, 404);
  if (isRecord(value.packet) && value.packet.clearsRegulatoryObligation !== false) {
    throw new EngineError("A packet cannot clear a regulatory obligation.");
  }
  if (isRecord(value.quarantine) && value.quarantine.approved !== false) {
    throw new EngineError("Quarantine cannot be stored as an approval.");
  }
  return responseFor(saveRun(value as unknown as RunState));
}

export function isBreakerState(value: unknown): value is BreakerState {
  return value === "closed" || value === "half-open" || value === "open";
}

export function publicLlmMode(): ReturnType<typeof llmMode> {
  return llmMode();
}
