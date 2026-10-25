"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { BreakerResponse } from "@/lib/dto";
import type { BreakerState } from "@/lib/types";

interface BreakerContextValue {
  data: BreakerResponse | null;
  error: string | null;
  cycle: (id: string, state: BreakerState) => void;
  reset: () => void;
}

const BreakerContext = createContext<BreakerContextValue | null>(null);

const NEXT_STATE: Record<BreakerState, BreakerState> = {
  closed: "half-open",
  "half-open": "open",
  open: "closed",
};

const OPEN_NOTE: Record<string, string> = {
  "CB-EXTRACT": "Extract will pause until you close CB-EXTRACT.",
  "CB-LLM": "The summarize node is suppressed. The packet goes to HITL without a narrative.",
  "CB-CONFIDENCE": "Soft auto-path is off while CB-CONFIDENCE is open.",
  "CB-HITL-BACKLOG":
    "Production would throttle intake and would still never auto-approve. This demo lets you open a folder so the gate stays visible.",
  "CB-CASE-WRITE": "Completions are frozen. The soft path is off, and Approve will not write a packet.",
  "CB-DATA-EGRESS": "The next step kills the run and opens a simulated security bridge.",
};

function persist(data: BreakerResponse) {
  sessionStorage.setItem(
    "ucdr:breakers",
    JSON.stringify(data.breakers.map((breaker) => ({ id: breaker.id, state: breaker.state }))),
  );
}

export function BreakerProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<BreakerResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const saved = sessionStorage.getItem("ucdr:breakers");
        const response = await fetch("/api/breakers", {
          method: saved ? "PUT" : "GET",
          cache: "no-store",
          headers: saved ? { "content-type": "application/json" } : undefined,
          body: saved ?? undefined,
        });
        const body = (await response.json()) as BreakerResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load breakers");
        if (!cancelled) {
          setData(body);
          persist(body);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load breakers");
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo<BreakerContextValue>(
    () => ({
      data,
      error,
      cycle: (id, state) => {
        const next = NEXT_STATE[state];
        void fetch("/api/breakers", {
          method: "PATCH",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ id, state: next }),
        })
          .then(async (response) => {
            const body = (await response.json()) as BreakerResponse & { error?: string };
            if (!response.ok) throw new Error(body.error || "Could not update the breaker");
            setData(body);
            persist(body);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not update the breaker");
          });
      },
      reset: () => {
        void fetch("/api/breakers", {
          method: "PATCH",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reset: true }),
        })
          .then(async (response) => {
            const body = (await response.json()) as BreakerResponse & { error?: string };
            if (!response.ok) throw new Error(body.error || "Could not reset breakers");
            setData(body);
            persist(body);
          })
          .catch((err: unknown) => {
            setError(err instanceof Error ? err.message : "Could not reset breakers");
          });
      },
    }),
    [data, error],
  );

  return <BreakerContext.Provider value={value}>{children}</BreakerContext.Provider>;
}

export function useBreakers(): BreakerContextValue {
  const value = useContext(BreakerContext);
  if (!value) throw new Error("Breaker strip is missing its provider");
  return value;
}

function stateClass(state: BreakerState): string {
  if (state === "open") return "border-signal bg-signal text-paper";
  if (state === "half-open") return "border-signal bg-paper text-signal";
  return "border-navy bg-paper text-navy";
}

export function BreakerStrip() {
  const { data, error, cycle, reset } = useBreakers();
  const open = data?.breakers.filter((breaker) => breaker.state === "open") ?? [];

  return (
    <section className="mx-auto mt-6 max-w-page px-4">
      <div className="mb-2 flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[0.68rem] uppercase tracking-[0.14em] text-signal">Circuit breakers · six CB-*</p>
          <p className="mt-1 max-w-3xl text-sm text-ink/80">
            {data?.caption ??
              "Example signals only. Illustrative design telemetry, not live bank KPIs."}{" "}
            Click a breaker to cycle closed, half-open, and open. Soft auto-path turns off when any breaker is open.
          </p>
        </div>
        <button
          type="button"
          onClick={reset}
          className="border border-ink px-3 py-1.5 font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy hover:border-signal hover:text-signal"
        >
          Reset illustrative states
        </button>
      </div>
      {error ? <p className="mb-2 text-sm text-signal">{error}</p> : null}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {(data?.breakers ?? []).map((breaker) => (
          <button
            key={breaker.id}
            type="button"
            onClick={() => cycle(breaker.id, breaker.state)}
            className={`min-w-[11.5rem] shrink-0 border-[1.5px] px-3 py-2 text-left ${stateClass(breaker.state)}`}
            aria-label={`${breaker.id} is ${breaker.state}. Activate to change state.`}
          >
            <span className="block font-mono text-[0.68rem] uppercase tracking-[0.08em]">{breaker.id}</span>
            <span className="mt-1 block font-display text-lg uppercase leading-none">{breaker.state}</span>
            <span className="mt-2 block text-xs leading-snug opacity-90">{breaker.name}</span>
            <span className="mt-2 block font-mono text-[0.65rem] uppercase tracking-[0.06em]">
              Example · {breaker.exampleSignal}
            </span>
          </button>
        ))}
        {data === null ? <p className="font-mono text-xs text-muted">Loading breaker strip…</p> : null}
      </div>
      <div className={`mt-3 border px-3 py-2 text-sm ${open.length > 0 ? "border-signal bg-stone" : "border-line bg-paper"}`}>
        {data === null ? (
          <p>Loading illustrative breaker states…</p>
        ) : open.length === 0 ? (
          <p>
            <span className="font-semibold">Soft auto-path available</span> for a low tier and a complete pack only.
            Half-open does not turn it off. A soft flag is non-clearing.
          </p>
        ) : (
          <div className="space-y-1">
            <p className="font-semibold">Soft auto-path disabled. {open.map((breaker) => breaker.id).join(", ")} open.</p>
            {open.map((breaker) => (
              <p key={breaker.id}>
                <span className="font-mono text-xs">{breaker.id}.</span> {OPEN_NOTE[breaker.id]}
              </p>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
