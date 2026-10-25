import type { BreakerDef, BreakerState, RunState } from "@/lib/types";

export type LlmMode = "fixture" | "openai" | "azure";

export interface CaseSummary {
  caseId: string;
  title: string;
  demoScript: string;
  subjectLabel: string;
  blurb: string;
  folderPath: string;
  profile: string;
  documents: Array<{ docId: string; fileName: string; classifiedType: string }>;
}

export interface BreakerResponse {
  caption: string;
  softAutoPathEnabled: boolean;
  llmMode: LlmMode;
  breakers: Array<BreakerDef & { state: BreakerState }>;
}

export interface RunResponse {
  run: RunState;
  folder: CaseSummary;
  advanced?: boolean;
}
