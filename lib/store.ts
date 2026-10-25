import { loadBreakerFile } from "@/lib/fixtures";
import type { BreakerDef, BreakerState, CaseFixture, RunState } from "@/lib/types";

interface Memory {
  runs: Map<string, RunState>;
  breakers: Map<string, BreakerState>;
  pastedCases: Map<string, CaseFixture>;
}

const globalStore = globalThis as typeof globalThis & { __ucdr01?: Memory };

function memory(): Memory {
  if (!globalStore.__ucdr01) {
    const defs = loadBreakerFile();
    globalStore.__ucdr01 = {
      runs: new Map(),
      breakers: new Map(defs.breakers.map((breaker) => [breaker.id, breaker.defaultState])),
      pastedCases: new Map(),
    };
  }
  if (!globalStore.__ucdr01.pastedCases) globalStore.__ucdr01.pastedCases = new Map();
  return globalStore.__ucdr01;
}

export function savePastedCase(caseFile: CaseFixture): void {
  memory().pastedCases.set(caseFile.caseId, caseFile);
}

export function getPastedCase(caseId: string): CaseFixture | undefined {
  return memory().pastedCases.get(caseId);
}

export function isPastedCase(caseId: string): boolean {
  return memory().pastedCases.has(caseId);
}

export function listBreakerViews(): Array<BreakerDef & { state: BreakerState }> {
  const defs = loadBreakerFile();
  const states = memory().breakers;
  return defs.breakers.map((breaker) => ({
    ...breaker,
    state: states.get(breaker.id) ?? breaker.defaultState,
  }));
}

export function breakerCaption(): string {
  return loadBreakerFile().caption;
}

export function softAutoPathEnabled(): boolean {
  return listBreakerViews().every((breaker) => breaker.state !== "open");
}

export function setBreakerState(id: string, state: BreakerState): void {
  const known = loadBreakerFile().breakers.some((breaker) => breaker.id === id);
  if (!known) throw new Error(`Unknown breaker ${id}`);
  memory().breakers.set(id, state);
}

export function resetBreakers(): void {
  const defs = loadBreakerFile();
  memory().breakers = new Map(defs.breakers.map((breaker) => [breaker.id, breaker.defaultState]));
}

export function saveRun(run: RunState): RunState {
  memory().runs.set(run.runId, run);
  return run;
}

export function getRun(runId: string): RunState | undefined {
  return memory().runs.get(runId);
}
