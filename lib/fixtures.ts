import breakersJson from "@/fixtures/breakers.json";
import caseHighConfidence from "@/fixtures/cases/case-high-confidence.json";
import caseLowComplete from "@/fixtures/cases/case-low-complete.json";
import caseMedGap from "@/fixtures/cases/case-med-gap.json";
import packJson from "@/fixtures/pack-v1.json";
import taxonomyJson from "@/fixtures/taxonomy.json";
import type {
  BreakerFile,
  BreakerState,
  CaseFixture,
  DocType,
  PackV1,
  ProfileId,
  TaxonomyFile,
} from "@/lib/types";

const DOC_TYPES: readonly DocType[] = [
  "passport",
  "proof_of_address",
  "bank_statement",
  "company_registry",
  "source_of_funds",
  "unknown",
];

const PROFILES: readonly ProfileId[] = ["individual_onboarding", "sme_onboarding"];
const BREAKER_STATES: readonly BreakerState[] = ["closed", "half-open", "open"];

/**
 * Static JSON imports. Webpack inlines these into the Node server bundle, so a
 * Vercel cold start does not need `fixtures/` on disk. `process.cwd()` +
 * `fs.readFileSync` is not file-traced and produced ENOENT for
 * `/var/task/fixtures/pack-v1.json`.
 */
const CASE_MODULES: ReadonlyArray<{ file: string; raw: unknown }> = [
  { file: "case-high-confidence.json", raw: caseHighConfidence },
  { file: "case-low-complete.json", raw: caseLowComplete },
  { file: "case-med-gap.json", raw: caseMedGap },
];

function cloneJson(value: unknown): unknown {
  return JSON.parse(JSON.stringify(value)) as unknown;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function needString(record: Record<string, unknown>, key: string, label: string): string {
  const value = record[key];
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`${label}: ${key} must be a non-empty string`);
  }
  return value;
}

function needNumber(record: Record<string, unknown>, key: string, label: string): number {
  const value = record[key];
  if (typeof value !== "number" || Number.isNaN(value)) {
    throw new Error(`${label}: ${key} must be a number`);
  }
  return value;
}

function parseCase(raw: unknown, label: string): CaseFixture {
  if (!isRecord(raw)) throw new Error(`${label} is not an object`);
  const profile = needString(raw, "profile", label);
  if (!PROFILES.includes(profile as ProfileId)) throw new Error(`${label}: unknown profile`);
  const documentsRaw = raw.documents;
  if (!Array.isArray(documentsRaw) || documentsRaw.length === 0) {
    throw new Error(`${label}: documents must be a non-empty array`);
  }
  const narrativeRaw = raw.fixtureNarrative;
  if (!isRecord(narrativeRaw) || !Array.isArray(narrativeRaw.factors)) {
    throw new Error(`${label}: fixtureNarrative is missing`);
  }

  return {
    caseId: needString(raw, "caseId", label),
    folderPath: needString(raw, "folderPath", label),
    profile: profile as ProfileId,
    title: needString(raw, "title", label),
    demoScript: needString(raw, "demoScript", label),
    subjectLabel: needString(raw, "subjectLabel", label),
    blurb: needString(raw, "blurb", label),
    identityConflict: raw.identityConflict === true,
    conflictNote: typeof raw.conflictNote === "string" ? raw.conflictNote : null,
    elevatedIndicators: Array.isArray(raw.elevatedIndicators)
      ? raw.elevatedIndicators.filter((item): item is string => typeof item === "string")
      : [],
    documents: documentsRaw.map((doc, index) => {
      if (!isRecord(doc)) throw new Error(`${label} document ${index} is invalid`);
      const classifiedType = needString(doc, "classifiedType", label);
      if (!DOC_TYPES.includes(classifiedType as DocType)) {
        throw new Error(`${label}: bad doc type ${classifiedType}`);
      }
      if (!Array.isArray(doc.fields)) throw new Error(`${label}: fields missing`);
      return {
        docId: needString(doc, "docId", label),
        fileName: needString(doc, "fileName", label),
        classifiedType: classifiedType as DocType,
        pages: needNumber(doc, "pages", label),
        fields: doc.fields.map((field) => {
          if (!isRecord(field)) throw new Error(`${label}: bad field`);
          return {
            id: needString(field, "id", label),
            label: needString(field, "label", label),
            value: typeof field.value === "string" ? field.value : "",
            confidence: needNumber(field, "confidence", label),
            page: needNumber(field, "page", label),
          };
        }),
      };
    }),
    fixtureNarrative: {
      summary: needString(narrativeRaw, "summary", label),
      factors: narrativeRaw.factors.map((factor) => {
        if (!isRecord(factor) || !Array.isArray(factor.citations)) {
          throw new Error(`${label}: bad narrative factor`);
        }
        return {
          id: needString(factor, "id", label),
          text: needString(factor, "text", label),
          citations: factor.citations.filter((cite): cite is string => typeof cite === "string"),
        };
      }),
    },
  };
}

let caseCache: CaseFixture[] | null = null;

export function loadCases(): CaseFixture[] {
  if (caseCache) return caseCache;
  caseCache = CASE_MODULES.slice()
    .sort((a, b) => (a.file < b.file ? -1 : a.file > b.file ? 1 : 0))
    .map((entry) => parseCase(cloneJson(entry.raw), entry.file));
  return caseCache;
}

export function loadCase(caseId: string): CaseFixture | undefined {
  return loadCases().find((item) => item.caseId === caseId);
}

export function loadPack(): PackV1 {
  const raw = cloneJson(packJson);
  if (!isRecord(raw)) throw new Error("PACK-v1 is invalid");
  return raw as unknown as PackV1;
}

export function loadTaxonomy(): TaxonomyFile {
  const raw = cloneJson(taxonomyJson);
  if (!isRecord(raw) || !Array.isArray(raw.entries)) throw new Error("taxonomy is invalid");
  return raw as unknown as TaxonomyFile;
}

export function loadBreakerFile(): BreakerFile {
  const raw = cloneJson(breakersJson);
  if (!isRecord(raw) || !Array.isArray(raw.breakers)) throw new Error("breakers file is invalid");
  for (const breaker of raw.breakers) {
    if (!isRecord(breaker)) throw new Error("breaker row is invalid");
    const state = breaker.defaultState;
    if (typeof state !== "string" || !BREAKER_STATES.includes(state as BreakerState)) {
      throw new Error("breaker defaultState is invalid");
    }
  }
  return raw as unknown as BreakerFile;
}
