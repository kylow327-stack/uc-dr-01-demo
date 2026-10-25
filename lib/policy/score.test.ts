import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { scoreCase, type ScoreInput } from "@/lib/policy/score";

function input(overrides: Partial<ScoreInput> = {}): ScoreInput {
  return {
    unknownTypeCount: 0,
    lowConfidenceCount: 0,
    identityConflict: false,
    elevatedIndicators: [],
    complete: true,
    breakers: [
      { id: "CB-EXTRACT", state: "closed" },
      { id: "CB-LLM", state: "closed" },
      { id: "CB-CONFIDENCE", state: "half-open" },
      { id: "CB-HITL-BACKLOG", state: "closed" },
      { id: "CB-CASE-WRITE", state: "closed" },
      { id: "CB-DATA-EGRESS", state: "closed" },
    ],
    ...overrides,
  };
}

describe("policy scorer", () => {
  it("routes a clean complete pack to low / soft while a breaker is only half-open", () => {
    const score = scoreCase(input());
    assert.equal(score.tier, "low");
    assert.equal(score.route, "soft");
    assert.deepEqual(score.policyRowIds, ["POL-06"]);
    assert.equal(score.tierSource, "policy_table");
    assert.equal(score.narrativeIgnored, true);
    assert.equal(score.softPathDisabled, false);
  });

  it("does not let an open breaker change the tier, and it does disable the soft path", () => {
    const score = scoreCase(
      input({
        breakers: input().breakers.map((breaker) =>
          breaker.id === "CB-CASE-WRITE" ? { ...breaker, state: "open" } : breaker,
        ),
      }),
    );
    assert.equal(score.tier, "low");
    assert.equal(score.route, "hitl");
    assert.equal(score.softPathDisabled, true);
    assert.deepEqual(score.openBreakers, ["CB-CASE-WRITE"]);
  });

  it("takes the highest matching tier and never returns soft", () => {
    const score = scoreCase(
      input({
        complete: false,
        lowConfidenceCount: 1,
        identityConflict: true,
        unknownTypeCount: 1,
        elevatedIndicators: ["fixture-elevated-indicator"],
      }),
    );
    assert.equal(score.tier, "high");
    assert.equal(score.route, "hitl");
    assert.deepEqual(score.policyRowIds, ["POL-01", "POL-02", "POL-03", "POL-04", "POL-05"]);
  });

  it("keeps a plain completeness gap at medium", () => {
    const score = scoreCase(input({ complete: false }));
    assert.equal(score.tier, "medium");
    assert.equal(score.route, "hitl");
    assert.deepEqual(score.policyRowIds, ["POL-05"]);
  });
});
