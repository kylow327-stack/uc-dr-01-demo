import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import { loadBreakerFile, loadCase, loadCases, loadPack, loadTaxonomy } from "@/lib/fixtures";

function jsonFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...jsonFiles(full));
    else if (entry.name.endsWith(".json")) out.push(full);
  }
  return out;
}

describe("fixture bundle", () => {
  it("loads every fixtures json file from the compiled module", () => {
    const root = process.cwd();
    const files = jsonFiles(path.join(root, "fixtures"));
    assert.ok(files.length >= 6, "expected the demo fixture set");

    const caseIds = new Set<string>();
    for (const file of files) {
      const relative = path.relative(root, file).split(path.sep).join("/");
      const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown>;
      if (relative === "fixtures/pack-v1.json") {
        assert.deepEqual(loadPack(), raw);
      } else if (relative === "fixtures/taxonomy.json") {
        assert.deepEqual(loadTaxonomy(), raw);
      } else if (relative === "fixtures/breakers.json") {
        assert.deepEqual(loadBreakerFile(), raw);
      } else if (relative.startsWith("fixtures/cases/") && relative.endsWith(".json")) {
        assert.equal(typeof raw.caseId, "string");
        const caseId = raw.caseId as string;
        const loaded = loadCase(caseId);
        assert.ok(loaded, `${relative} is not imported by lib/fixtures.ts`);
        assert.equal(loaded.caseId, caseId);
        assert.equal(loaded.documents.length, (raw.documents as unknown[]).length);
        caseIds.add(caseId);
      } else {
        assert.fail(`${relative} is not wired into lib/fixtures.ts`);
      }
    }

    assert.deepEqual(
      loadCases()
        .map((item) => item.caseId)
        .sort(),
      [...caseIds].sort(),
    );
  });
});
