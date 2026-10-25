export type RiskTier = "low" | "medium" | "high";

export type BreakerState = "closed" | "half-open" | "open";

export type DocType =
  | "passport"
  | "proof_of_address"
  | "bank_statement"
  | "company_registry"
  | "source_of_funds"
  | "unknown";

export type ProfileId = "individual_onboarding" | "sme_onboarding";

export interface TaxonomyEntry {
  id: Exclude<DocType, "unknown">;
  label: string;
  description: string;
}

export interface TaxonomyFile {
  taxonomyId: string;
  entries: TaxonomyEntry[];
}

export interface FieldValue {
  id: string;
  label: string;
  value: string;
  confidence: number;
  page: number;
}

export interface FixtureDocument {
  docId: string;
  fileName: string;
  classifiedType: DocType;
  pages: number;
  fields: FieldValue[];
}

export interface NarrativeFactor {
  id: string;
  text: string;
  citations: string[];
}

export type NarrativeSource = "fixture" | "llm" | "fixture_fallback" | "suppressed";

export interface Narrative {
  summary: string;
  factors: NarrativeFactor[];
  source: NarrativeSource;
  droppedUncited: number;
  note: string | null;
}

export interface CaseFixture {
  caseId: string;
  folderPath: string;
  profile: ProfileId;
  title: string;
  demoScript: string;
  subjectLabel: string;
  blurb: string;
  identityConflict: boolean;
  conflictNote: string | null;
  elevatedIndicators: string[];
  documents: FixtureDocument[];
  fixtureNarrative: {
    summary: string;
    factors: Array<{ id: string; text: string; citations: string[] }>;
  };
}

export interface PackProfile {
  label: string;
  requiredDocs: Array<Exclude<DocType, "unknown">>;
  requiredFields: Partial<Record<Exclude<DocType, "unknown">, string[]>>;
}

export interface PackV1 {
  packId: "PACK-v1";
  confidenceFloor: number;
  allowPrefix: string;
  profiles: Record<ProfileId, PackProfile>;
}

export interface BreakerDef {
  id: string;
  name: string;
  trip: string;
  degrade: string;
  defaultState: BreakerState;
  exampleSignal: string;
}

export interface BreakerFile {
  caption: string;
  breakers: BreakerDef[];
}

export interface Gap {
  kind: "missing_doc" | "missing_field";
  docType: string;
  fieldId?: string;
  citationId: string;
  message: string;
}

export interface LowConfidenceField {
  docId: string;
  fieldId: string;
  label: string;
  confidence: number;
  citationId: string;
}

export interface CompletenessResult {
  packId: "PACK-v1";
  profile: ProfileId;
  complete: boolean;
  gaps: Gap[];
  lowConfidenceFields: LowConfidenceField[];
  unknownTypes: Array<{ docId: string; fileName: string; classifiedType: string }>;
  requiredFieldCount: number;
  lowConfidenceShare: number;
}

export interface PolicyMatch {
  id: string;
  tier: RiskTier;
  reason: string;
}

export interface ScoreResult {
  tier: RiskTier;
  route: "soft" | "hitl";
  policyRowIds: string[];
  reasons: string[];
  softPathDisabled: boolean;
  openBreakers: string[];
  tierSource: "policy_table";
  narrativeIgnored: true;
}

export type NodeId =
  | "intake_folder"
  | "classify_doc_type"
  | "extract_fields"
  | "completeness_check"
  | "risk_summarize"
  | "score_and_route"
  | "auto_flag_soft"
  | "hitl_interrupt"
  | "write_case_packet"
  | "emit_langfuse_eval"
  | "egress_kill";

export type NodeStatus =
  | "passed"
  | "attention"
  | "paused"
  | "waiting"
  | "failed"
  | "skipped"
  | "killed";

export type NodePayload =
  | {
      kind: "intake";
      folderPath: string;
      allowPrefix: string;
      accepted: boolean;
    }
  | {
      kind: "classify";
      documents: Array<{
        docId: string;
        fileName: string;
        classifiedType: string;
        inTaxonomy: boolean;
      }>;
    }
  | {
      kind: "extract";
      confidenceFloor: number;
      lowConfidenceShare: number;
      documents: Array<{
        docId: string;
        fileName: string;
        classifiedType: string;
        fields: Array<{
          citationId: string;
          label: string;
          value: string;
          confidence: number;
          page: number;
          belowFloor: boolean;
        }>;
      }>;
    }
  | { kind: "completeness"; result: CompletenessResult }
  | { kind: "summary"; narrative: Narrative }
  | { kind: "score"; score: ScoreResult }
  | { kind: "soft"; packetId: string }
  | { kind: "hitl"; reasons: string[] }
  | { kind: "write"; packetId: string; disposition: SorDisposition }
  | { kind: "eval"; traceId: string }
  | { kind: "killed"; reason: string }
  | { kind: "frozen"; reason: string };

export interface NodeRecord {
  nodeId: NodeId;
  controls: string[];
  status: NodeStatus;
  title: string;
  detail: string;
  payload: NodePayload;
  at: string;
}

export type SorDisposition = "non_clearing_soft_flag" | "analyst_accepted_packet";

export interface SorPacket {
  packetId: string;
  auditId: string;
  caseId: string;
  runId: string;
  disposition: SorDisposition;
  clearsRegulatoryObligation: false;
  tier: RiskTier;
  policyRowIds: string[];
  tierSource: "policy_table";
  narrative: Narrative | null;
  analystNote: string | null;
  traceId: string;
  writtenAt: string;
  idempotent: true;
  label: string;
}

export type HitlActionName = "approve" | "edit" | "reject" | "escalate" | "timeout";

export interface HitlState {
  action: HitlActionName | null;
  note: string | null;
  at: string | null;
  analystAcceptedPacket: boolean;
}

export type RunPhase =
  | "ready"
  | "in_progress"
  | "paused"
  | "hitl_waiting"
  | "edited"
  | "soft_written"
  | "packet_written"
  | "frozen"
  | "rejected"
  | "escalated"
  | "quarantine"
  | "killed";

export interface RunState {
  runId: string;
  caseId: string;
  traceId: string;
  createdAt: string;
  updatedAt: string;
  stepIndex: number;
  phase: RunPhase;
  nodes: NodeRecord[];
  completeness: CompletenessResult | null;
  narrative: Narrative | null;
  score: ScoreResult | null;
  hitl: HitlState;
  packet: SorPacket | null;
  quarantine: { at: string; reason: string; approved: false } | null;
  securityBridge: { opened: true; reason: string; at: string } | null;
  freeze: { at: string; reason: string; written: false } | null;
  revision: number;
}

export interface PolicyRow {
  id: string;
  when: string;
  tier: RiskTier;
  route: "soft" | "hitl";
  control: string;
}
