import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { groundNarrative, narrativeFromModelJson } from "@/lib/graph/citations";

const allowed = ["cite:CASE-2041:DOC-PASSPORT-01:full_name"];

describe("grounded narrative", () => {
  it("drops uncited factors and ignores a model tier", () => {
    const narrative = narrativeFromModelJson(
      {
        tier: "low",
        summary: "The passport name is present in the extract.",
        factors: [
          { text: "Name is present.", citations: ["cite:CASE-2041:DOC-PASSPORT-01:full_name"] },
          { text: "Invented factor.", citations: ["cite:not-in-the-pack"] },
          { text: "No cite at all.", citations: [] },
        ],
      },
      allowed,
    );
    assert.equal(narrative.factors.length, 1);
    assert.equal(narrative.droppedUncited, 2);
    assert.equal(narrative.source, "llm");
    assert.equal("tier" in narrative, false);
    assert.match(narrative.note ?? "", /tier field/i);
  });

  it("drops wording that claims a clearance or an auto-approval", () => {
    const narrative = groundNarrative(
      {
        summary: "The regulatory obligation is cleared.",
        factors: [
          {
            text: "Timeout should auto-approve this folder.",
            citations: ["cite:CASE-2041:DOC-PASSPORT-01:full_name"],
          },
        ],
      },
      allowed,
      "llm",
    );
    assert.equal(narrative.factors.length, 0);
    assert.match(narrative.summary, /withheld/i);
  });

  it("keeps a sentence that says the obligation is not cleared", () => {
    const narrative = groundNarrative(
      {
        summary: "This briefing does not clear a regulatory obligation.",
        factors: [
          {
            text: "The passport name is present. It does not clear a regulatory obligation.",
            citations: ["cite:CASE-2041:DOC-PASSPORT-01:full_name"],
          },
        ],
      },
      allowed,
      "fixture",
    );
    assert.equal(narrative.factors.length, 1);
    assert.match(narrative.summary, /does not clear/i);
  });
});
