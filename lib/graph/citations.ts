import type { CaseFixture, CompletenessResult, Narrative, NarrativeSource } from "@/lib/types";

export function fieldCitation(caseId: string, docId: string, fieldId: string): string {
  return `cite:${caseId}:${docId}:${fieldId}`;
}

export function allowedCitations(caseFile: CaseFixture, completeness: CompletenessResult): string[] {
  const cites = new Set<string>();
  for (const doc of caseFile.documents) {
    for (const field of doc.fields) {
      cites.add(fieldCitation(caseFile.caseId, doc.docId, field.id));
    }
  }
  for (const gap of completeness.gaps) cites.add(gap.citationId);
  if (caseFile.identityConflict) cites.add(`conflict:${caseFile.caseId}:identity`);
  for (const indicator of caseFile.elevatedIndicators) {
    cites.add(`indicator:${caseFile.caseId}:${indicator}`);
  }
  return [...cites];
}

const CLEARANCE =
  /auto-?approv|(?:regulatory\s+)?obligation\s+is\s+cleared|cleared\s+the\s+(?:regulatory\s+)?obligation|(?:has\s+been|is|was)\s+cleared|clears\s+(?:the\s+)?(?:regulatory\s+)?obligation|regulatory\s+clearance/i;

export interface NarrativeDraft {
  summary?: unknown;
  factors?: unknown;
  tier?: unknown;
}

function asFactorList(value: unknown): Array<{ id?: unknown; text?: unknown; citations?: unknown }> {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is { id?: unknown; text?: unknown; citations?: unknown } => {
    return typeof item === "object" && item !== null;
  });
}

/**
 * CP-LLM. Keeps a factor only when every citation is on the allow-list and
 * at least one citation is present. Ignores any tier field on the draft.
 */
export function groundNarrative(
  draft: NarrativeDraft,
  allowed: readonly string[],
  source: NarrativeSource,
): Narrative {
  const allow = new Set(allowed);
  const dropped: string[] = [];
  const factors: Narrative["factors"] = [];
  let index = 0;

  for (const factor of asFactorList(draft.factors)) {
    index += 1;
    const text = typeof factor.text === "string" ? factor.text.trim() : "";
    const citations = Array.isArray(factor.citations)
      ? factor.citations.filter((cite): cite is string => typeof cite === "string" && cite.length > 0)
      : [];
    const grounded = citations.length > 0 && citations.every((cite) => allow.has(cite));
    if (!text || !grounded || CLEARANCE.test(text)) {
      dropped.push(text || `factor-${index}`);
      continue;
    }
    const id = typeof factor.id === "string" && factor.id.trim() ? factor.id.trim() : `RF-${index}`;
    factors.push({ id, text, citations });
    if (factors.length === 8) break;
  }

  let summary = typeof draft.summary === "string" ? draft.summary.trim().slice(0, 700) : "";
  let note: string | null = null;
  if (!summary || CLEARANCE.test(summary)) {
    summary = "Summary withheld. A grounded briefing may only describe cited fields, gaps, and fixture indicators.";
    note = "Summary failed the grounding check.";
  }
  if (draft.tier !== undefined) {
    note = note
      ? `${note} A tier field on the model payload was ignored.`
      : "A tier field on the model payload was ignored.";
  }
  if (dropped.length > 0) {
    const dropNote = `${dropped.length} factor(s) dropped because a citation was missing, unknown, or the text claimed a clearance.`;
    note = note ? `${note} ${dropNote}` : dropNote;
  }

  return {
    summary,
    factors,
    source,
    droppedUncited: dropped.length,
    note,
  };
}

export function narrativeFromModelJson(raw: unknown, allowed: readonly string[]): Narrative {
  const draft: NarrativeDraft =
    typeof raw === "object" && raw !== null ? (raw as NarrativeDraft) : { summary: "", factors: [] };
  return groundNarrative(draft, allowed, "llm");
}
