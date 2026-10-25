"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Marks } from "@/components/Marks";
import { useRun } from "@/components/useRun";
import { formatConfidence, phaseLabel } from "@/lib/format";
import { NODE_PLAN } from "@/lib/constants";
import type { NodeRecord, RunPhase } from "@/lib/types";

function phaseClass(phase: RunPhase): string {
  if (phase === "quarantine" || phase === "killed" || phase === "frozen" || phase === "rejected") {
    return "bg-signal text-paper";
  }
  if (phase === "soft_written" || phase === "packet_written") return "bg-navy text-paper";
  if (phase === "hitl_waiting" || phase === "edited" || phase === "paused" || phase === "escalated") {
    return "border border-signal text-signal";
  }
  return "border border-line text-navy";
}

function NodeBody({ node }: { node: NodeRecord }) {
  const payload = node.payload;
  if (payload.kind === "intake") {
    return (
      <p>
        Allow-list prefix <span className="font-mono text-sm">{payload.allowPrefix}</span>. Folder{" "}
        <span className="font-mono text-sm">{payload.folderPath}</span> is {payload.accepted ? "accepted" : "rejected"}.
      </p>
    );
  }
  if (payload.kind === "classify") {
    return (
      <ul className="space-y-2">
        {payload.documents.map((doc) => (
          <li key={doc.docId} className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line py-1">
            <span>
              {doc.fileName}{" "}
              <span className="font-mono text-xs text-muted">{doc.docId}</span>
            </span>
            <span className={doc.inTaxonomy ? "font-mono text-xs uppercase text-navy" : "font-mono text-xs uppercase text-signal"}>
              {doc.classifiedType} · {doc.inTaxonomy ? "in taxonomy" : "unknown"}
            </span>
          </li>
        ))}
      </ul>
    );
  }
  if (payload.kind === "extract") {
    if (payload.documents.length === 0) return <p>No fields were extracted while the breaker is open.</p>;
    return (
      <div className="space-y-4">
        <p className="text-sm">
          Floor {formatConfidence(payload.confidenceFloor)}. Low-confidence share of required fields{" "}
          {(payload.lowConfidenceShare * 100).toFixed(0)}%. The illustrative CB-CONFIDENCE trip is above 25%. A single
          field under the floor still forces HITL at CP-EXT.
        </p>
        {payload.documents.map((doc) => (
          <div key={doc.docId}>
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy">
              {doc.docId} · {doc.classifiedType}
            </p>
            <ul className="mt-2 space-y-2">
              {doc.fields.map((field) => (
                <li key={field.citationId}>
                  <div className="flex flex-wrap justify-between gap-2 text-sm">
                    <span>
                      {field.label}: {field.value || "—"} <span className="text-muted">p.{field.page}</span>
                    </span>
                    <span className={field.belowFloor ? "font-mono text-signal" : "font-mono text-navy"}>
                      {formatConfidence(field.confidence)}
                      {field.belowFloor ? " below floor" : ""}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 bg-stone">
                    <div
                      className={field.belowFloor ? "h-1.5 bg-signal" : "h-1.5 bg-navy"}
                      style={{ width: `${Math.max(2, Math.min(100, field.confidence * 100))}%` }}
                    />
                  </div>
                  <p className="mt-1 font-mono text-[0.65rem] text-muted">{field.citationId}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    );
  }
  if (payload.kind === "completeness") {
    const result = payload.result;
    return (
      <div className="space-y-3 text-sm">
        <p>
          Pack {result.packId} · profile {result.profile} · {result.complete ? "checklist matched" : "gaps found"}.
          Rules were read from the pack file.
        </p>
        {result.gaps.length === 0 ? (
          <p>No missing required documents or fields.</p>
        ) : (
          <ul className="space-y-2">
            {result.gaps.map((gap) => (
              <li key={gap.citationId} className="border border-signal px-3 py-2">
                <p>{gap.message}</p>
                <p className="mt-1 font-mono text-[0.65rem]">{gap.citationId}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (payload.kind === "summary") {
    const narrative = payload.narrative;
    return (
      <div className="space-y-3 text-sm">
        <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy">Source · {narrative.source}</p>
        <p>{narrative.summary}</p>
        {narrative.note ? <p className="text-muted">{narrative.note}</p> : null}
        <ul className="space-y-3">
          {narrative.factors.map((factor) => (
            <li key={factor.id} className="border border-line px-3 py-2">
              <p className="font-mono text-[0.65rem] text-navy">{factor.id}</p>
              <p className="mt-1">{factor.text}</p>
              <p className="mt-2 font-mono text-[0.65rem] text-muted">{factor.citations.join(" · ")}</p>
            </li>
          ))}
        </ul>
        <p className="text-muted">This briefing does not set the risk tier and does not clear a regulatory obligation.</p>
      </div>
    );
  }
  if (payload.kind === "score") {
    const score = payload.score;
    return (
      <div className="space-y-3 text-sm">
        <p>
          Tier <span className="font-display text-2xl uppercase">{score.tier}</span> · route{" "}
          <span className="font-display text-2xl uppercase">{score.route}</span>
        </p>
        <p className="font-mono text-xs uppercase tracking-[0.08em] text-navy">
          Tier source: {score.tierSource}. Narrative ignored: {String(score.narrativeIgnored)}.
        </p>
        <ul className="space-y-2">
          {score.reasons.map((reason) => (
            <li key={reason} className="border-b border-line py-1">
              {reason}
            </li>
          ))}
        </ul>
      </div>
    );
  }
  if (payload.kind === "soft" || payload.kind === "write") {
    return (
      <p className="text-sm">
        Packet <span className="font-mono">{payload.packetId}</span>
        {payload.kind === "write" ? ` · ${payload.disposition}` : ""}. clearsRegulatoryObligation is false.
      </p>
    );
  }
  if (payload.kind === "hitl") {
    return (
      <ul className="space-y-2 text-sm">
        {payload.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    );
  }
  if (payload.kind === "eval") {
    return <p className="font-mono text-sm">{payload.traceId} · simulated trace, not a live Langfuse project.</p>;
  }
  return <p className="text-sm">{payload.reason}</p>;
}

function focusNode(run: { phase: RunPhase; nodes: NodeRecord[] } | null, latest: NodeRecord | null): NodeRecord | null {
  if (!run) return latest;
  const find = (id: NodeRecord["nodeId"]) => run.nodes.find((node) => node.nodeId === id) ?? null;
  if (
    run.phase === "hitl_waiting" ||
    run.phase === "edited" ||
    run.phase === "quarantine" ||
    run.phase === "rejected" ||
    run.phase === "escalated" ||
    run.phase === "frozen"
  ) {
    return find("hitl_interrupt") ?? find("score_and_route") ?? latest;
  }
  if (run.phase === "soft_written" || run.phase === "packet_written") {
    return find("auto_flag_soft") ?? find("score_and_route") ?? latest;
  }
  if (run.phase === "killed") return find("egress_kill") ?? latest;
  return latest;
}

export function RunView({ runId }: { runId: string }) {
  const { run, folder, error, note, pending, act } = useRun(runId);
  const [pinned, setPinned] = useState<string | null>(null);
  useEffect(() => {
    setPinned(null);
  }, [run?.revision]);
  const latest = run?.nodes[run.nodes.length - 1] ?? null;
  const focused = focusNode(run, latest);
  const selected = run?.nodes.find((node) => node.nodeId === pinned) ?? focused;
  const waiting = run?.phase === "hitl_waiting" || run?.phase === "edited";

  return (
    <section>
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-signal">Run view · LangGraph-shaped steps</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">{folder?.title ?? "Case run"}</h1>
        {run ? <span className={`px-2 py-1 font-mono text-[0.68rem] uppercase tracking-wider ${phaseClass(run.phase)}`}>{phaseLabel(run.phase)}</span> : null}
      </div>
      {folder ? (
        <p className="mt-3 max-w-3xl text-sm leading-relaxed">
          {folder.subjectLabel}. <span className="font-mono text-xs">{folder.folderPath}</span>. {folder.blurb}
        </p>
      ) : null}
      {run ? (
        <p className="mt-2 font-mono text-[0.68rem] uppercase tracking-[0.06em] text-muted">
          {run.runId} · trace {run.traceId}
        </p>
      ) : null}
      {error ? <p className="mt-3 text-sm text-signal">{error}</p> : null}
      {note ? <p className="mt-3 text-sm text-navy">{note}</p> : null}

      <div className="mt-5 flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending || !run}
          onClick={() => void act(`/api/runs/${runId}/step`, { method: "POST" })}
          className="border border-navy bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-ink disabled:opacity-50"
        >
          Step node
        </button>
        <button
          type="button"
          disabled={pending || !run}
          onClick={() => void act(`/api/runs/${runId}/play`, { method: "POST" })}
          className="border border-ink px-4 py-2 text-sm font-semibold hover:border-signal disabled:opacity-50"
        >
          Run to decision
        </button>
        <Link href={`/runs/${runId}/hitl`} className="border border-ink px-4 py-2 text-sm font-semibold hover:border-signal">
          {waiting ? "Open HITL interrupt" : "HITL interrupt"}
        </Link>
        <Link href={`/runs/${runId}/packet`} className="border border-ink px-4 py-2 text-sm font-semibold hover:border-signal">
          SoR packet
        </Link>
        <Link href="/" className="px-2 py-2 text-sm text-navy underline decoration-line underline-offset-4">
          Case board
        </Link>
      </div>

      {run?.score ? (
        <p className="mt-4 border border-navy bg-stone px-3 py-2 text-sm">
          <span className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy">Decision</span>
          {" · "}
          {phaseLabel(run.phase)} · tier {run.score.tier} · route {run.score.route} · source {run.score.tierSource}
          {run.phase === "quarantine" ? " · not approved" : ""}
          {run.packet ? " · clearsRegulatoryObligation false" : ""}
        </p>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-[16rem_1fr]">
        <ol className="space-y-2">
          {NODE_PLAN.filter((item) => item.nodeId !== "egress_kill").map((item) => {
            const record = run?.nodes.find((node) => node.nodeId === item.nodeId);
            const active = selected?.nodeId === item.nodeId;
            return (
              <li key={item.nodeId}>
                <button
                  type="button"
                  disabled={!record}
                  onClick={() => setPinned(item.nodeId)}
                  className={`w-full border px-3 py-2 text-left disabled:opacity-50 ${active ? "border-ink bg-stone" : "border-line bg-paper"}`}
                >
                  <span className="block font-display text-lg uppercase leading-none">{item.title}</span>
                  <span className="mt-1 block font-mono text-[0.65rem] uppercase tracking-[0.06em] text-navy">
                    {item.controls.join(" · ")}
                    {record ? ` · ${record.status}` : " · pending"}
                  </span>
                </button>
              </li>
            );
          })}
          {run?.nodes.some((node) => node.nodeId === "egress_kill") ? (
            <li>
              <button
                type="button"
                onClick={() => setPinned("egress_kill")}
                className="w-full border border-signal bg-signal px-3 py-2 text-left text-paper"
              >
                <span className="block font-display text-lg uppercase leading-none">Egress kill</span>
                <span className="mt-1 block font-mono text-[0.65rem] uppercase tracking-[0.06em]">CP-NET · CB-DATA-EGRESS</span>
              </button>
            </li>
          ) : null}
        </ol>

        <article className="border-[1.5px] border-ink p-4">
          {selected ? (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="font-display text-3xl uppercase leading-none">{selected.title}</h2>
                <Marks ids={selected.controls} />
              </div>
              <p className="mt-3 text-sm leading-relaxed">{selected.detail}</p>
              <div className="mt-4">
                <NodeBody node={selected} />
              </div>
            </>
          ) : (
            <p className="text-sm">Step the graph to run intake. Each node shows its CP-* control.</p>
          )}
        </article>
      </div>

      {run?.narrative && run.narrative.factors.length > 0 ? (
        <section className="mt-4 border border-line p-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-display text-2xl uppercase">Grounded factors</h2>
            <Marks ids={["CP-LLM"]} />
          </div>
          <ul className="mt-3 space-y-3">
            {run.narrative.factors.map((factor) => (
              <li key={factor.id} className="text-sm">
                <p>{factor.text}</p>
                <p className="mt-1 font-mono text-[0.65rem] text-navy">{factor.citations.join(" · ")}</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
