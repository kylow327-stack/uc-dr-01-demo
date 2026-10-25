import { fieldCitation, groundNarrative, narrativeFromModelJson } from "@/lib/graph/citations";
import type { NarrativeDraft } from "@/lib/graph/citations";
import type { SummarizeInput } from "@/lib/graph/engine";
import { isPastedCase } from "@/lib/store";
import type { Narrative } from "@/lib/types";

export type LlmMode = "fixture" | "openai" | "azure";

export function llmMode(): LlmMode {
  if (
    process.env.AZURE_OPENAI_API_KEY &&
    process.env.AZURE_OPENAI_ENDPOINT &&
    process.env.AZURE_OPENAI_DEPLOYMENT
  ) {
    return "azure";
  }
  if (process.env.OPENAI_API_KEY) return "openai";
  return "fixture";
}

function fixtureNarrative(input: SummarizeInput, source: "fixture" | "fixture_fallback", note: string | null): Narrative {
  const grounded = groundNarrative(input.caseFile.fixtureNarrative, input.allowedCitations, source);
  if (note) grounded.note = grounded.note ? `${note} ${grounded.note}` : note;
  return grounded;
}

function joinNotes(...parts: Array<string | null | undefined>): string | null {
  const text = parts.filter((part): part is string => typeof part === "string" && part.trim() !== "").join(" ");
  return text || null;
}

/** Grounded briefing from the pasted extract and checklist gaps, using the same citation ids the fixture packs use. */
function draftFromExtract(input: SummarizeInput): NarrativeDraft {
  const { caseFile, completeness } = input;
  const factors: Array<{ id: string; text: string; citations: string[] }> = [];
  for (const doc of caseFile.documents) {
    for (const field of doc.fields) {
      if (factors.length >= 6) break;
      const value = field.value.trim() || "blank";
      factors.push({
        id: `RF-EXT-${factors.length + 1}`,
        text: `${field.label} on ${doc.fileName} is “${value}”.`,
        citations: [fieldCitation(caseFile.caseId, doc.docId, field.id)],
      });
    }
  }
  for (const gap of completeness.gaps) {
    if (factors.length >= 8) break;
    factors.push({
      id: `RF-GAP-${factors.length + 1}`,
      text: gap.message,
      citations: [gap.citationId],
    });
  }
  if (caseFile.identityConflict && factors.length < 8) {
    factors.push({
      id: "RF-CONFLICT",
      text: caseFile.conflictNote?.trim() || "Identity strings differ in this pasted pack.",
      citations: [`conflict:${caseFile.caseId}:identity`],
    });
  }
  for (const indicator of caseFile.elevatedIndicators) {
    if (factors.length >= 8) break;
    factors.push({
      id: `RF-IND-${factors.length + 1}`,
      text: `Fixture elevated indicator ${indicator} is present on this pasted pack.`,
      citations: [`indicator:${caseFile.caseId}:${indicator}`],
    });
  }
  const gapCount = completeness.gaps.length;
  return {
    summary: `Pasted folder ${caseFile.caseId} has ${caseFile.documents.length} document(s) and ${gapCount} checklist gap(s). This briefing cites the extract and the gaps only. It does not assign a risk tier.`,
    factors,
  };
}

function pastedBriefing(input: SummarizeInput, note: string): Narrative {
  const grounded = groundNarrative(input.caseFile.fixtureNarrative, input.allowedCitations, "fixture_fallback");
  if (grounded.factors.length > 0) {
    grounded.note = joinNotes(note, grounded.note);
    return grounded;
  }
  const synthesized = groundNarrative(draftFromExtract(input), input.allowedCitations, "fixture_fallback");
  synthesized.note = joinNotes(
    note,
    "The pasted fixtureNarrative had no grounded factors, so this briefing was built from the extract and the gaps.",
    synthesized.note,
  );
  return synthesized;
}

export async function buildNarrative(input: SummarizeInput): Promise<Narrative> {
  if (input.suppressLlm) {
    return {
      summary: "Narrative suppressed. CB-LLM is open, so this packet goes to HITL without a model briefing.",
      factors: [],
      source: "suppressed",
      droppedUncited: 0,
      note: "CB-LLM degrade: stop the summarize node.",
    };
  }
  const pasted = isPastedCase(input.caseFile.caseId);
  if (llmMode() === "fixture") {
    if (pasted) {
      return pastedBriefing(
        input,
        "No model key is set. The briefing is grounded from this pasted pack. The tier is not set here.",
      );
    }
    return fixtureNarrative(input, "fixture", null);
  }

  try {
    const raw = await draftWithModel(input);
    const grounded = narrativeFromModelJson(raw, input.allowedCitations);
    if (grounded.factors.length === 0) {
      if (pasted) {
        return pastedBriefing(
          input,
          "The model returned no grounded factors. The pasted briefing was kept. Any tier in the model payload was ignored.",
        );
      }
      return fixtureNarrative(
        input,
        "fixture_fallback",
        "The model returned no grounded factors. The fixture briefing was kept. Any tier in the model payload was ignored.",
      );
    }
    return grounded;
  } catch {
    if (pasted) {
      return pastedBriefing(
        input,
        "The model call failed. The pasted briefing was kept. The tier was not taken from the model.",
      );
    }
    return fixtureNarrative(
      input,
      "fixture_fallback",
      "The model call failed. The fixture briefing was kept. The tier was not taken from the model.",
    );
  }
}

async function draftWithModel(input: SummarizeInput): Promise<unknown> {
  const mode = llmMode();
  const evidence = {
    caseId: input.caseFile.caseId,
    subjectLabel: input.caseFile.subjectLabel,
    identityConflict: input.caseFile.identityConflict,
    conflictCitation: input.caseFile.identityConflict ? `conflict:${input.caseFile.caseId}:identity` : null,
    elevatedIndicators: input.caseFile.elevatedIndicators.map((id) => ({
      id,
      citationId: `indicator:${input.caseFile.caseId}:${id}`,
    })),
    gaps: input.completeness.gaps,
    documents: input.caseFile.documents.map((doc) => ({
      docId: doc.docId,
      classifiedType: doc.classifiedType,
      fields: doc.fields.map((field) => ({
        citationId: fieldCitation(input.caseFile.caseId, doc.docId, field.id),
        label: field.label,
        value: field.value,
        confidence: field.confidence,
        page: field.page,
      })),
    })),
    allowedCitations: input.allowedCitations,
  };

  const body = {
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content:
          "You draft a short document-risk briefing for a fictional demo. Do not assign a risk tier. Do not say an obligation is cleared or that anything is approved. Use only citation ids from allowedCitations. Return JSON with keys summary (string) and factors (array of {text, citations}). Every factor needs at least one allowed citation. Drop anything you cannot cite.",
      },
      { role: "user", content: JSON.stringify(evidence) },
    ],
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20000);
  try {
    if (mode === "azure") {
      const endpoint = process.env.AZURE_OPENAI_ENDPOINT?.replace(/\/$/, "");
      const deployment = process.env.AZURE_OPENAI_DEPLOYMENT;
      const version = process.env.AZURE_OPENAI_API_VERSION || "2024-10-21";
      const response = await fetch(
        `${endpoint}/openai/deployments/${deployment}/chat/completions?api-version=${version}`,
        {
          method: "POST",
          signal: controller.signal,
          headers: {
            "content-type": "application/json",
            "api-key": process.env.AZURE_OPENAI_API_KEY ?? "",
          },
          body: JSON.stringify(body),
        },
      );
      if (!response.ok) throw new Error("azure request failed");
      return readContent(await response.json());
    }

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      signal: controller.signal,
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${process.env.OPENAI_API_KEY ?? ""}`,
      },
      body: JSON.stringify({ ...body, model: process.env.OPENAI_MODEL || "gpt-4o-mini" }),
    });
    if (!response.ok) throw new Error("openai request failed");
    return readContent(await response.json());
  } finally {
    clearTimeout(timer);
  }
}

function readContent(payload: unknown): unknown {
  if (typeof payload !== "object" || payload === null) throw new Error("empty model payload");
  const choices = "choices" in payload ? payload.choices : undefined;
  if (!Array.isArray(choices) || choices.length === 0) throw new Error("no choices");
  const first = choices[0];
  if (typeof first !== "object" || first === null || !("message" in first)) throw new Error("no message");
  const message = first.message;
  if (typeof message !== "object" || message === null || !("content" in message)) throw new Error("no content");
  const content = message.content;
  if (typeof content !== "string") throw new Error("content was not text");
  return JSON.parse(content) as unknown;
}
