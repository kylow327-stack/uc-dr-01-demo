"use client";

import Link from "next/link";
import { Marks } from "@/components/Marks";
import { useRun } from "@/components/useRun";
import { formatStamp } from "@/lib/format";

export function PacketView({ runId }: { runId: string }) {
  const { run, folder, error, pending } = useRun(runId);
  const packet = run?.packet ?? null;

  return (
    <section>
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-signal">Simulated Case/GRC · CP-CASE</p>
      <h1 className="mt-3 font-display text-4xl uppercase leading-none sm:text-5xl">SoR packet</h1>
      <p className="mt-3 text-sm text-muted">
        <Link href={`/runs/${runId}`} className="text-navy underline decoration-line underline-offset-4">
          Back to the run
        </Link>
        {folder ? ` · ${folder.caseId}` : ""}
      </p>
      {error ? <p className="mt-3 text-sm text-signal">{error}</p> : null}
      {pending && !run ? <p className="mt-4 text-sm">Loading packet…</p> : null}

      {run && !packet ? (
        <div className="mt-6 border-[1.5px] border-ink p-5">
          <h2 className="font-display text-3xl uppercase">No packet written</h2>
          <p className="mt-3 max-w-2xl text-sm leading-relaxed">
            A soft flag is written only for a low, complete pack while every breaker is closed. An analyst acceptance
            writes a separate non-clearing packet. Timeout, reject, escalate, a frozen write, and an egress kill do
            not write one. Nothing here has cleared a regulatory obligation.
          </p>
          {run.phase === "quarantine" ? (
            <p className="mt-4 border border-signal bg-stone px-3 py-2 text-sm">
              Quarantine. Not approved. {run.quarantine?.reason}
            </p>
          ) : null}
          {run.phase === "frozen" ? (
            <p className="mt-4 border border-signal bg-stone px-3 py-2 text-sm">{run.freeze?.reason}</p>
          ) : null}
          <Link href={`/runs/${runId}/hitl`} className="mt-4 inline-block text-sm text-navy underline decoration-line underline-offset-4">
            Open the HITL interrupt
          </Link>
        </div>
      ) : null}

      {packet ? (
        <div className="mt-6">
          <div className="bg-navy px-5 py-6 text-paper">
            <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-ember">
              {packet.disposition === "non_clearing_soft_flag" ? "Non-clearing soft flag" : "Analyst-accepted packet"}
            </p>
            <h2 className="mt-3 font-display text-4xl uppercase leading-none sm:text-5xl">Does not clear the obligation</h2>
            <p className="mt-4 max-w-2xl text-base leading-relaxed">{packet.label}</p>
            <p className="mt-4 font-mono text-sm">clearsRegulatoryObligation = false</p>
          </div>
          <dl className="mt-4 grid gap-px border border-ink bg-line sm:grid-cols-2">
            {[
              ["Packet id", packet.packetId],
              ["Audit id", packet.auditId],
              ["Trace", packet.traceId],
              ["Tier", `${packet.tier} · ${packet.tierSource}`],
              ["Policy rows", packet.policyRowIds.join(", ")],
              ["Written", formatStamp(packet.writtenAt)],
            ].map(([label, value]) => (
              <div key={label} className="bg-paper px-4 py-3">
                <dt className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-navy">{label}</dt>
                <dd className="mt-1 font-mono text-sm">{value}</dd>
              </div>
            ))}
          </dl>
          <div className="mt-4 flex flex-wrap gap-2">
            <Marks ids={["CP-CASE", "CP-SCORE", "CP-EVAL"]} />
          </div>
          {packet.analystNote ? (
            <aside className="mt-4 border border-navy px-4 py-3 text-sm">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy">Analyst note</p>
              <p className="mt-2">{packet.analystNote}</p>
            </aside>
          ) : null}
          {packet.narrative ? (
            <div className="mt-4 space-y-3">
              <p className="text-sm">{packet.narrative.summary}</p>
              <ul className="space-y-2">
                {packet.narrative.factors.map((factor) => (
                  <li key={factor.id} className="border border-line px-3 py-2 text-sm">
                    <span className="font-mono text-[0.65rem] text-navy">{factor.id}</span>
                    <p className="mt-1">{factor.text}</p>
                    <p className="mt-1 font-mono text-[0.65rem] text-muted">{factor.citations.join(" · ")}</p>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <p className="mt-4 text-sm">No narrative was attached. The tier still came from the policy table.</p>
          )}
        </div>
      ) : null}

      {run ? (
        <div className="mt-6">
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-signal">
            {packet ? "Packet JSON" : "Decision JSON"}
          </p>
          <pre className="mt-2 max-h-[24rem] overflow-auto border border-ink bg-ink p-4 font-mono text-[0.72rem] leading-relaxed text-paper">
            {JSON.stringify(
              {
                caseId: run.caseId,
                phase: run.phase,
                tier: run.score?.tier ?? null,
                route: run.score?.route ?? null,
                tierSource: run.score?.tierSource ?? null,
                policyRowIds: run.score?.policyRowIds ?? [],
                quarantine: run.quarantine,
                packet,
              },
              null,
              2,
            )}
          </pre>
        </div>
      ) : null}
    </section>
  );
}
