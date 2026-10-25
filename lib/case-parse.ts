import { intakeAllows } from "@/lib/graph/completeness";
import type { CaseFixture, DocType, ProfileId } from "@/lib/types";

export const RESERVED_CASE_IDS = ["CASE-2041", "CASE-2077", "CASE-2118"] as const;

const DOC_TYPES: readonly DocType[] = [
  "passport",
  "proof_of_address",
  "bank_statement",
  "company_registry",
  "source_of_funds",
  "unknown",
];

const PROFILES: readonly ProfileId[] = ["individual_onboarding", "sme_onboarding"];
const ALLOW_PREFIX = "cases/allow/";
const MAX_ERRORS = 40;

export interface FieldError {
  path: string;
  message: string;
}

export type CaseParseResult = { ok: true; value: CaseFixture } | { ok: false; errors: FieldError[] };

export class CaseValidationError extends Error {
  readonly fields: FieldError[];

  constructor(fields: FieldError[]) {
    super("Pasted case JSON is invalid.");
    this.name = "CaseValidationError";
    this.fields = fields;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function parsePastedCase(raw: unknown): CaseParseResult {
  const errors: FieldError[] = [];
  const fail = (path: string, message: string) => {
    if (errors.length < MAX_ERRORS) errors.push({ path, message });
  };

  if (!isRecord(raw)) {
    return { ok: false, errors: [{ path: "$", message: "Case JSON must be an object." }] };
  }

  const caseId = readId(raw.caseId, "caseId", fail);
  if (caseId && (RESERVED_CASE_IDS as readonly string[]).includes(caseId)) {
    fail("caseId", `${caseId} is a built-in demo folder. Choose a different id for a pasted pack.`);
  }

  const folderPath = readString(raw.folderPath, "folderPath", 180, fail);
  if (folderPath && !intakeAllows(folderPath, ALLOW_PREFIX)) {
    fail(
      "folderPath",
      "must be cases/allow/ followed by one segment of letters, numbers, dots, underscores, or hyphens.",
    );
  }

  const profile = readEnum(raw.profile, "profile", PROFILES, fail);
  const title = readString(raw.title, "title", 160, fail);
  const demoScript = readString(raw.demoScript, "demoScript", 160, fail);
  const subjectLabel = readString(raw.subjectLabel, "subjectLabel", 200, fail);
  const blurb = readString(raw.blurb, "blurb", 600, fail);

  let identityConflict = false;
  if (typeof raw.identityConflict !== "boolean") {
    fail("identityConflict", "must be true or false.");
  } else {
    identityConflict = raw.identityConflict;
  }

  let conflictNote: string | null = null;
  if (raw.conflictNote === undefined || raw.conflictNote === null) {
    conflictNote = null;
  } else if (typeof raw.conflictNote !== "string") {
    fail("conflictNote", "must be a string or null.");
  } else if (raw.conflictNote.length > 400) {
    fail("conflictNote", "is too long.");
  } else {
    conflictNote = raw.conflictNote;
  }

  const elevatedIndicators = readStringList(raw.elevatedIndicators, "elevatedIndicators", 8, 64, fail);
  const documents = readDocuments(raw.documents, fail);
  const fixtureNarrative = readNarrative(raw.fixtureNarrative, fail);

  if (
    errors.length > 0 ||
    !caseId ||
    !folderPath ||
    !profile ||
    !title ||
    !demoScript ||
    !subjectLabel ||
    !blurb ||
    !documents ||
    !fixtureNarrative ||
    !elevatedIndicators
  ) {
    return { ok: false, errors: errors.length > 0 ? errors : [{ path: "$", message: "Case JSON is incomplete." }] };
  }

  return {
    ok: true,
    value: {
      caseId,
      folderPath,
      profile,
      title,
      demoScript,
      subjectLabel,
      blurb,
      identityConflict,
      conflictNote,
      elevatedIndicators,
      documents,
      fixtureNarrative,
    },
  };
}

function readId(value: unknown, path: string, fail: (path: string, message: string) => void): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "must be a non-empty string.");
    return null;
  }
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{1,48}$/.test(value)) {
    fail(path, "use letters, numbers, dots, underscores, or hyphens (2–49 characters).");
    return null;
  }
  return value;
}

function readString(
  value: unknown,
  path: string,
  max: number,
  fail: (path: string, message: string) => void,
): string | null {
  if (typeof value !== "string" || value.trim() === "") {
    fail(path, "must be a non-empty string.");
    return null;
  }
  if (value.length > max) {
    fail(path, `must be at most ${max} characters.`);
    return null;
  }
  return value;
}

function readEnum<T extends string>(
  value: unknown,
  path: string,
  allowed: readonly T[],
  fail: (path: string, message: string) => void,
): T | null {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    fail(path, `must be one of ${allowed.join(", ")}.`);
    return null;
  }
  return value as T;
}

function readStringList(
  value: unknown,
  path: string,
  maxItems: number,
  maxLen: number,
  fail: (path: string, message: string) => void,
): string[] | null {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    fail(path, "must be an array of strings.");
    return null;
  }
  if (value.length > maxItems) {
    fail(path, `must contain at most ${maxItems} items.`);
    return null;
  }
  const items: string[] = [];
  value.forEach((item, index) => {
    if (typeof item !== "string" || item.trim() === "" || item.length > maxLen) {
      fail(`${path}[${index}]`, `must be a non-empty string of at most ${maxLen} characters.`);
      return;
    }
    items.push(item);
  });
  return items;
}

function readDocuments(
  value: unknown,
  fail: (path: string, message: string) => void,
): CaseFixture["documents"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    fail("documents", "must be a non-empty array.");
    return null;
  }
  if (value.length > 8) {
    fail("documents", "must contain at most 8 documents.");
    return null;
  }
  const documents: CaseFixture["documents"] = [];
  value.forEach((item, index) => {
    const path = `documents[${index}]`;
    if (!isRecord(item)) {
      fail(path, "must be an object.");
      return;
    }
    const docId = readId(item.docId, `${path}.docId`, fail);
    const fileName = readString(item.fileName, `${path}.fileName`, 180, fail);
    const classifiedType = readEnum(item.classifiedType, `${path}.classifiedType`, DOC_TYPES, fail);
    const pages = readInt(item.pages, `${path}.pages`, 1, 40, fail);
    const fields = readFields(item.fields, `${path}.fields`, fail);
    if (!docId || !fileName || !classifiedType || pages === null || !fields) return;
    documents.push({ docId, fileName, classifiedType, pages, fields });
  });
  if (documents.length !== value.length) return null;
  return documents;
}

function readFields(
  value: unknown,
  path: string,
  fail: (path: string, message: string) => void,
): CaseFixture["documents"][number]["fields"] | null {
  if (!Array.isArray(value) || value.length === 0) {
    fail(path, "must be a non-empty array.");
    return null;
  }
  if (value.length > 24) {
    fail(path, "must contain at most 24 fields.");
    return null;
  }
  const fields: CaseFixture["documents"][number]["fields"] = [];
  value.forEach((item, index) => {
    const fieldPath = `${path}[${index}]`;
    if (!isRecord(item)) {
      fail(fieldPath, "must be an object.");
      return;
    }
    const id = readId(item.id, `${fieldPath}.id`, fail);
    const label = readString(item.label, `${fieldPath}.label`, 120, fail);
    let fieldValue = "";
    if (typeof item.value !== "string") {
      fail(`${fieldPath}.value`, "must be a string.");
    } else if (item.value.length > 300) {
      fail(`${fieldPath}.value`, "must be at most 300 characters.");
    } else {
      fieldValue = item.value;
    }
    const confidence = readConfidence(item.confidence, `${fieldPath}.confidence`, fail);
    const page = readInt(item.page, `${fieldPath}.page`, 1, 40, fail);
    if (!id || !label || confidence === null || page === null || typeof item.value !== "string" || item.value.length > 300) {
      return;
    }
    fields.push({ id, label, value: fieldValue, confidence, page });
  });
  if (fields.length !== value.length) return null;
  return fields;
}

function readNarrative(
  value: unknown,
  fail: (path: string, message: string) => void,
): CaseFixture["fixtureNarrative"] | null {
  if (!isRecord(value)) {
    fail("fixtureNarrative", "must be an object with summary and factors.");
    return null;
  }
  const summary = readString(value.summary, "fixtureNarrative.summary", 700, fail);
  if (!Array.isArray(value.factors)) {
    fail("fixtureNarrative.factors", "must be an array.");
    return null;
  }
  if (value.factors.length > 12) {
    fail("fixtureNarrative.factors", "must contain at most 12 factors.");
    return null;
  }
  const factors: CaseFixture["fixtureNarrative"]["factors"] = [];
  value.factors.forEach((item, index) => {
    const path = `fixtureNarrative.factors[${index}]`;
    if (!isRecord(item)) {
      fail(path, "must be an object.");
      return;
    }
    const id = readId(item.id, `${path}.id`, fail);
    const text = readString(item.text, `${path}.text`, 500, fail);
    if (!Array.isArray(item.citations)) {
      fail(`${path}.citations`, "must be an array of citation ids.");
      return;
    }
    const citations: string[] = [];
    item.citations.forEach((cite, citeIndex) => {
      if (typeof cite !== "string" || cite.trim() === "" || cite.length > 180) {
        fail(`${path}.citations[${citeIndex}]`, "must be a non-empty citation id.");
        return;
      }
      citations.push(cite);
    });
    if (!id || !text || citations.length !== item.citations.length) return;
    factors.push({ id, text, citations });
  });
  if (!summary || factors.length !== value.factors.length) return null;
  return { summary, factors };
}

function readInt(
  value: unknown,
  path: string,
  min: number,
  max: number,
  fail: (path: string, message: string) => void,
): number | null {
  if (typeof value !== "number" || !Number.isInteger(value) || value < min || value > max) {
    fail(path, `must be an integer from ${min} to ${max}.`);
    return null;
  }
  return value;
}

function readConfidence(value: unknown, path: string, fail: (path: string, message: string) => void): number | null {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(path, "must be a number from 0 to 1.");
    return null;
  }
  return value;
}
