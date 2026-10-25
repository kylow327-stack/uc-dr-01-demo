"use client";

import Link from "next/link";
import { useState } from "react";
import { useRun } from "@/components/useRun";
import { phaseLabel } from "@/lib/format";

export function HitlView({ runId }: { runId: string }) {
  const { run, folder, error, pending, act } = useRun(runId);
  const [note, setNote] = useState("");
  const [editing, setEditing] = useState(false);
  const actionable = run?.phase === "hitl_waiting" || run?.phase === "edited";

  async function send(action: "approve" | "edit" | "reject" | "escalate") {
    await act(`/api/runs/${runId}/hitl`, {
      method: "POST",
      body: JSON.stringify({ action, note: note || run?.hitl.note || null }),
    });
    if (action === "edit") setEditing(false);
  }

  return (
    <section>
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-signal">CP-HITL · human gate</p>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
        <h1 className="font-display text-4xl uppercase leading-none sm:text-5xl">HITL interrupt</h1>
        {run ? <span className="font-mono text-xs uppercase tracking-[0.08em] text-navy">{phaseLabel(run.phase)}</span> : null}
      </div>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed">
        Approve, edit, reject, or escalate. {folder ? `${folder.title}. ` : ""}
        Approve records an analyst-accepted packet and still does not clear a regulatory obligation. Edit stores a note
        and does not write. Timeout is a separate action: quarantine, never approve.
      </p>
      <p className="mt-2 text-sm">
        <Link href={`/runs/${runId}`} className="text-navy underline decoration-line underline-offset-4">
          Back to the run
        </Link>
      </p>
      {error ? <p className="mt-3 text-sm text-signal">{error}</p> : null}

      {run?.score ? (
        <div className="mt-5 border-[1.5px] border-ink p-4 text-sm">
          <p>
            Policy tier <span className="font-display text-2xl uppercase">{run.score.tier}</span> · route{" "}
            <span className="uppercase">{run.score.route}</span>
          </p>
          <ul className="mt-3 space-y-2">
            {run.score.reasons.map((reason) => (
              <li key={reason} className="border-b border-line py-1">
                {reason}
              </li>
            ))}
          </ul>
          {run.completeness && run.completeness.gaps.length > 0 ? (
            <ul className="mt-3 space-y-2">
              {run.completeness.gaps.map((gap) => (
                <li key={gap.citationId} className="border border-signal px-3 py-2">
                  {gap.message}
                  <span className="mt-1 block font-mono text-[0.65rem]">{gap.citationId}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : (
        <p className="mt-5 text-sm">The interrupt appears after score and route. Step the run, or use Run to decision.</p>
      )}

      {run?.hitl.note ? (
        <p className="mt-4 border border-navy px-3 py-2 text-sm">
          <span className="font-mono text-[0.65rem] uppercase tracking-[0.08em] text-navy">Saved note. </span>
          {run.hitl.note}
        </p>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_18rem]">
        <div className="border-[1.5px] border-ink p-4">
          <h2 className="font-display text-2xl uppercase">Decision</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!actionable || pending}
              onClick={() => void send("approve")}
              className="border border-navy bg-navy px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40"
            >
              Approve
            </button>
            <button
              type="button"
              disabled={!actionable || pending}
              onClick={() => setEditing((value) => !value)}
              className="border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Edit
            </button>
            <button
              type="button"
              disabled={!actionable || pending}
              onClick={() => void send("reject")}
              className="border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Reject
            </button>
            <button
              type="button"
              disabled={!actionable || pending}
              onClick={() => void send("escalate")}
              className="border border-ink px-4 py-2 text-sm font-semibold disabled:opacity-40"
            >
              Escalate
            </button>
          </div>
          {editing ? (
            <div className="mt-4">
              <label htmlFor="analyst-note" className="font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy">
                Analyst note
              </label>
              <textarea
                id="analyst-note"
                value={note}
                onChange={(event) => setNote(event.target.value)}
                rows={4}
                className="mt-2 w-full border border-ink bg-paper px-3 py-2 text-sm"
                placeholder="Correction or instruction. Saving an edit does not write the SoR."
              />
              <button
                type="button"
                disabled={!actionable || pending}
                onClick={() => void send("edit")}
                className="mt-2 border border-navy px-4 py-2 text-sm font-semibold text-navy disabled:opacity-40"
              >
                Save edit
              </button>
            </div>
          ) : null}
          <p className="mt-4 text-sm leading-relaxed text-muted">
            Approve writes the simulated packet with your note if you saved one. Reject and escalate leave the
            obligation unchanged and write nothing.
          </p>
          {run?.packet ? (
            <Link href={`/runs/${runId}/packet`} className="mt-3 inline-block text-sm text-navy underline decoration-line underline-offset-4">
              View the non-clearing packet
            </Link>
          ) : null}
        </div>

        <aside className="border-[1.5px] border-signal p-4">
          <h2 className="font-display text-2xl uppercase text-signal">Timeout</h2>
          <p className="mt-2 text-sm leading-relaxed">
            Simulate an analyst timeout. The case moves to quarantine. It is not approved, and no soft flag is written.
          </p>
          <button
            type="button"
            disabled={!actionable || pending}
            onClick={() => void act(`/api/runs/${runId}/timeout`, { method: "POST" })}
            className="mt-4 border border-signal bg-signal px-4 py-2 text-sm font-semibold text-paper disabled:opacity-40"
          >
            Simulate timeout
          </button>
          {run?.phase === "quarantine" ? (
            <div className="mt-4 bg-signal px-3 py-3 text-paper">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em]">Quarantine · not approved</p>
              <p className="mt-2 text-sm">{run.quarantine?.reason}</p>
              <p className="mt-2 font-mono text-xs">approved = false</p>
            </div>
          ) : null}
        </aside>
      </div>

      {run?.phase === "rejected" || run?.phase === "escalated" || run?.phase === "frozen" || run?.phase === "killed" ? (
        <p className="mt-4 border border-ink bg-stone px-4 py-3 text-sm">
          {run.phase === "rejected" && "Rejected. No SoR flag. The obligation is unchanged."}
          {run.phase === "escalated" && "Escalated to the simulated Risk Ops queue. Not written. Not an approval."}
          {run.phase === "frozen" && (run.freeze?.reason ?? "Write frozen. Not approved.")}
          {run.phase === "killed" && (run.securityBridge?.reason ?? "Run killed.")}
        </p>
      ) : null}
    </section>
  );
}
