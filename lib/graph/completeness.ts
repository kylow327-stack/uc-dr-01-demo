import { fieldCitation } from "@/lib/graph/citations";
import type { CaseFixture, CompletenessResult, DocType, PackV1 } from "@/lib/types";

const TAXONOMY: ReadonlySet<string> = new Set([
  "passport",
  "proof_of_address",
  "bank_statement",
  "company_registry",
  "source_of_funds",
]);

export function isKnownType(value: string): value is Exclude<DocType, "unknown"> {
  return TAXONOMY.has(value);
}

export function checkCompleteness(
  caseFile: CaseFixture,
  pack: PackV1,
  taxonomyIds: readonly string[],
): CompletenessResult {
  const taxonomy = new Set(taxonomyIds);
  const profile = pack.profiles[caseFile.profile];
  const byType = new Map<string, CaseFixture["documents"]>();
  const unknownTypes: CompletenessResult["unknownTypes"] = [];

  for (const doc of caseFile.documents) {
    if (!taxonomy.has(doc.classifiedType) || doc.classifiedType === "unknown") {
      unknownTypes.push({
        docId: doc.docId,
        fileName: doc.fileName,
        classifiedType: doc.classifiedType,
      });
      continue;
    }
    const list = byType.get(doc.classifiedType) ?? [];
    list.push(doc);
    byType.set(doc.classifiedType, list);
  }

  const gaps: CompletenessResult["gaps"] = [];
  for (const docType of profile.requiredDocs) {
    const docs = byType.get(docType) ?? [];
    if (docs.length === 0) {
      gaps.push({
        kind: "missing_doc",
        docType,
        citationId: `gap:${caseFile.caseId}:missing_doc:${docType}`,
        message: `Required document “${docType}” is not in the named folder.`,
      });
      continue;
    }
    const requiredFields = profile.requiredFields[docType] ?? [];
    for (const fieldId of requiredFields) {
      const present = docs.some((doc) =>
        doc.fields.some((field) => field.id === fieldId && field.value.trim().length > 0),
      );
      if (!present) {
        gaps.push({
          kind: "missing_field",
          docType,
          fieldId,
          citationId: `gap:${caseFile.caseId}:missing_field:${docType}:${fieldId}`,
          message: `Required field “${fieldId}” is missing on ${docType}.`,
        });
      }
    }
  }

  const lowConfidenceFields: CompletenessResult["lowConfidenceFields"] = [];
  let requiredFieldCount = 0;
  for (const doc of caseFile.documents) {
    if (!isKnownType(doc.classifiedType)) continue;
    const required = new Set(profile.requiredFields[doc.classifiedType] ?? []);
    for (const field of doc.fields) {
      if (!required.has(field.id)) continue;
      requiredFieldCount += 1;
      if (field.confidence < pack.confidenceFloor) {
        lowConfidenceFields.push({
          docId: doc.docId,
          fieldId: field.id,
          label: field.label,
          confidence: field.confidence,
          citationId: fieldCitation(caseFile.caseId, doc.docId, field.id),
        });
      }
    }
  }

  const lowConfidenceShare = requiredFieldCount === 0 ? 0 : lowConfidenceFields.length / requiredFieldCount;

  return {
    packId: "PACK-v1",
    profile: caseFile.profile,
    complete: gaps.length === 0,
    gaps,
    lowConfidenceFields,
    unknownTypes,
    requiredFieldCount,
    lowConfidenceShare,
  };
}

export function intakeAllows(folderPath: string, allowPrefix: string): boolean {
  if (!folderPath.startsWith(allowPrefix)) return false;
  if (folderPath.includes("..") || folderPath.includes("\\")) return false;
  const rest = folderPath.slice(allowPrefix.length);
  return /^[A-Za-z0-9._-]+$/.test(rest);
}
