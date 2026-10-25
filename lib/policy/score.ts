import type { BreakerState, PolicyRow, RiskTier, ScoreResult } from "@/lib/types";

/** CP-SCORE. The only place a tier is assigned. Narrative text is not an input. */
export const POLICY_ROWS: readonly PolicyRow[] = [
  {
    id: "POL-01",
    when: "Any file is outside the frozen taxonomy (unknown type).",
    tier: "high",
    route: "hitl",
    control: "CP-CLS",
  },
  {
    id: "POL-02",
    when: "Any required field is present with confidence below 0.90.",
    tier: "high",
    route: "hitl",
    control: "CP-EXT",
  },
  {
    id: "POL-03",
    when: "The fixture records an identity conflict across documents.",
    tier: "high",
    route: "hitl",
    control: "CP-SCORE",
  },
  {
    id: "POL-04",
    when: "The fixture carries an elevated indicator.",
    tier: "high",
    route: "hitl",
    control: "CP-SCORE",
  },
  {
    id: "POL-05",
    when: "PACK-v1 required document or field is missing.",
    tier: "medium",
    route: "hitl",
    control: "CP-GAP",
  },
  {
    id: "POL-06",
    when: "None of the rows above match: complete pack, no unknown type, no low-confidence required field, no conflict, no elevated indicator.",
    tier: "low",
    route: "soft",
    control: "CP-SCORE",
  },
] as const;

const TIER_RANK: Record<RiskTier, number> = { low: 0, medium: 1, high: 2 };

export interface ScoreInput {
  unknownTypeCount: number;
  lowConfidenceCount: number;
  identityConflict: boolean;
  elevatedIndicators: string[];
  complete: boolean;
  breakers: Array<{ id: string; state: BreakerState }>;
}

export function scoreCase(input: ScoreInput): ScoreResult {
  const matched: Array<{ id: string; tier: RiskTier; reason: string }> = [];

  if (input.unknownTypeCount > 0) {
    matched.push({
      id: "POL-01",
      tier: "high",
      reason: `${input.unknownTypeCount} file(s) sit outside the taxonomy. Unknown types go to HITL and are never auto-routed.`,
    });
  }
  if (input.lowConfidenceCount > 0) {
    matched.push({
      id: "POL-02",
      tier: "high",
      reason: `${input.lowConfidenceCount} required field(s) are below the 0.90 confidence floor. CP-EXT forces HITL.`,
    });
  }
  if (input.identityConflict) {
    matched.push({
      id: "POL-03",
      tier: "high",
      reason: "Fixture identity conflict across documents. HITL. The narrative does not choose this tier.",
    });
  }
  if (input.elevatedIndicators.length > 0) {
    matched.push({
      id: "POL-04",
      tier: "high",
      reason: `Fixture elevated indicator(s): ${input.elevatedIndicators.join(", ")}. HITL. This is demo data, not a live screening result.`,
    });
  }
  if (!input.complete) {
    matched.push({
      id: "POL-05",
      tier: "medium",
      reason: "PACK-v1 checklist has at least one missing document or field. Gap list goes to HITL.",
    });
  }

  let tier: RiskTier = "low";
  let route: ScoreResult["route"] = "soft";
  if (matched.length === 0) {
    matched.push({
      id: "POL-06",
      tier: "low",
      reason: "Policy table row POL-06. Low tier and complete pack. Soft flag is non-clearing and does not retire a regulatory obligation.",
    });
  } else {
    for (const row of matched) {
      if (TIER_RANK[row.tier] > TIER_RANK[tier]) tier = row.tier;
    }
    route = "hitl";
  }

  const openBreakers = input.breakers.filter((breaker) => breaker.state === "open").map((breaker) => breaker.id);
  const softPathDisabled = openBreakers.length > 0;
  if (route === "soft" && softPathDisabled) {
    route = "hitl";
    matched.push({
      id: "ROUTE-BREAKER",
      tier: "low",
      reason: `Soft auto-path disabled because ${openBreakers.join(", ")} is open. Tier stays ${tier} from the policy table. Opening a breaker never approves the case.`,
    });
  }

  const policyRowIds = matched.map((row) => row.id).filter((id) => id.startsWith("POL-"));

  return {
    tier,
    route,
    policyRowIds,
    reasons: matched.map((row) => `${row.id}: ${row.reason}`),
    softPathDisabled,
    openBreakers,
    tierSource: "policy_table",
    narrativeIgnored: true,
  };
}
