import type { NodeId } from "@/lib/types";

export const CONTROL_POINTS: Array<{ id: string; name: string; where: string; check: string; fail: string }> = [
  {
    id: "CP-INTAKE",
    name: "Folder allow-list",
    where: "intake_folder",
    check: "Path sits in the approved case roots",
    fail: "Reject the run",
  },
  {
    id: "CP-CLS",
    name: "Taxonomy gate",
    where: "classify_doc_type",
    check: "Type is in the frozen taxonomy, or it is unknown",
    fail: "Unknown type to HITL",
  },
  {
    id: "CP-EXT",
    name: "Field confidence",
    where: "extract_fields",
    check: "Required-field confidence is at least 0.90",
    fail: "Force HITL",
  },
  {
    id: "CP-GAP",
    name: "Completeness",
    where: "completeness_check",
    check: "Required documents and fields are present",
    fail: "Gap list to HITL",
  },
  {
    id: "CP-HOOK",
    name: "Rules outside the model",
    where: "PACK-v1",
    check: "The checklist lives in the policy pack, not only in a prompt",
    fail: "Block a deploy that inlines the checklist",
  },
  {
    id: "CP-LLM",
    name: "Grounded summary",
    where: "risk_summarize",
    check: "Every factor cites an id from the extract, a gap, or a fixture indicator",
    fail: "Drop uncited factors",
  },
  {
    id: "CP-SCORE",
    name: "Deterministic tier",
    where: "score_and_route",
    check: "Tier comes from the policy table only",
    fail: "A scorer unit-test failure blocks deploy",
  },
  {
    id: "CP-HITL",
    name: "Human gate",
    where: "hitl_interrupt",
    check: "Approve, edit, reject, or escalate",
    fail: "Timeout goes to quarantine",
  },
  {
    id: "CP-CASE",
    name: "SoR write",
    where: "write_case_packet",
    check: "Idempotent packet id on the simulated Case/GRC record",
    fail: "Retry, then dead-letter. An open CB-CASE-WRITE freezes the write",
  },
  {
    id: "CP-NET",
    name: "Private egress",
    where: "platform",
    check: "Allow-list endpoints only",
    fail: "Kill the run and open an incident bridge",
  },
  {
    id: "CP-EVAL",
    name: "Trace and eval",
    where: "emit_langfuse_eval",
    check: "A trace id is attached to every case",
    fail: "Alert if the trace id is missing",
  },
];

export const NODE_PLAN: Array<{ nodeId: NodeId; title: string; controls: string[] }> = [
  { nodeId: "intake_folder", title: "Intake folder", controls: ["CP-INTAKE"] },
  { nodeId: "classify_doc_type", title: "Classify document type", controls: ["CP-CLS"] },
  { nodeId: "extract_fields", title: "Extract fields", controls: ["CP-EXT"] },
  { nodeId: "completeness_check", title: "Completeness check", controls: ["CP-GAP", "CP-HOOK"] },
  { nodeId: "risk_summarize", title: "Grounded summary", controls: ["CP-LLM"] },
  { nodeId: "score_and_route", title: "Score and route", controls: ["CP-SCORE"] },
  { nodeId: "auto_flag_soft", title: "Soft flag", controls: ["CP-SCORE"] },
  { nodeId: "hitl_interrupt", title: "HITL interrupt", controls: ["CP-HITL"] },
  { nodeId: "write_case_packet", title: "Write case packet", controls: ["CP-CASE"] },
  { nodeId: "emit_langfuse_eval", title: "Emit trace", controls: ["CP-EVAL"] },
  { nodeId: "egress_kill", title: "Egress kill", controls: ["CP-NET", "CB-DATA-EGRESS"] },
];

export const FMEA_ROWS: Array<{ id: string; mode: string; s: number; o: number; d: number; rpn: number; controls: string; action: string }> = [
  { id: "FM-01", mode: "Wrong doc-type classification", s: 8, o: 4, d: 5, rpn: 160, controls: "CP-CLS, CB-CONFIDENCE", action: "Unknown type to HITL" },
  { id: "FM-02", mode: "OCR / extract field error", s: 9, o: 5, d: 4, rpn: 180, controls: "CP-EXT, CB-EXTRACT", action: "Field confidence gate; cite the page" },
  { id: "FM-03", mode: "LLM invents a risk factor", s: 7, o: 5, d: 6, rpn: 210, controls: "CP-LLM, CP-SCORE", action: "JSON schema and grounded citations only" },
  { id: "FM-04", mode: "LLM under-states risk", s: 10, o: 3, d: 5, rpn: 150, controls: "CP-SCORE, CP-HITL, CB-LLM", action: "Deterministic tier; never an LLM-alone tier" },
  { id: "FM-05", mode: "Missing-info rule bypassed", s: 9, o: 3, d: 3, rpn: 81, controls: "CP-GAP, CP-HOOK", action: "Checklist lives outside the model" },
  { id: "FM-06", mode: "HITL skipped, or timeout treated as approve", s: 10, o: 2, d: 2, rpn: 40, controls: "CP-HITL, CB-HITL-BACKLOG", action: "Timeout to quarantine, never approve" },
  { id: "FM-07", mode: "Case SoR write failure after a soft flag", s: 8, o: 3, d: 3, rpn: 72, controls: "CP-CASE, CB-CASE-WRITE", action: "Idempotent write; retry; alert" },
  { id: "FM-08", mode: "PII egress to a public model endpoint", s: 10, o: 2, d: 4, rpn: 80, controls: "CP-NET, CB-DATA-EGRESS", action: "Private endpoints only; egress allow-list" },
  { id: "FM-09", mode: "Prompt / checklist drift", s: 7, o: 4, d: 5, rpn: 140, controls: "CP-EVAL, CB-CONFIDENCE", action: "Eval traces and change control" },
  { id: "FM-10", mode: "Whole-estate crawl mis-scope", s: 9, o: 2, d: 4, rpn: 72, controls: "CP-INTAKE", action: "Named case folders only in v1" },
];

export const GATES: Array<{ id: string; status: string; detail: string }> = [
  {
    id: "BR-SIGN-OFF",
    status: "Pending",
    detail: "Risk, Compliance, InfoSec, and Ops sign. PACK-v1 and the taxonomy freeze before any build on a live folder.",
  },
  {
    id: "PoC-GO",
    status: "Not started",
    detail: "Gold-set targets on redacted packs. No production PII. Breaker stubs trip. A chat demo is not this gate.",
  },
  {
    id: "UAT-ACCEPT",
    status: "Not started",
    detail: "Scripts UAT-01 to UAT-07: soft flag, missing field, name conflict, low confidence, HITL timeout, case API down, blocked egress.",
  },
  {
    id: "PROD-STEADY",
    status: "Not started",
    detail: "Steady state is a later gate: no Sev-1 for 30 days, breaker drills passed, dual-run inside band. This repo is not that gate.",
  },
];

export const HARD_RULES: string[] = [
  "Timeout moves the case to quarantine. It never approves.",
  "Risk tier comes from the policy table only. The narrative model cannot set it.",
  "Soft path is low tier plus a complete pack, and only while every breaker is closed.",
  "A soft flag is a non-clearing SoR mark. It never clears a regulatory obligation.",
];
