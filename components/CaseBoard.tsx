"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useBreakers } from "@/components/BreakerBar";
import type { CaseSummary } from "@/lib/dto";

const DOC_LABEL: Record<string, string> = {
  passport: "Passport",
  proof_of_address: "Proof of address",
  bank_statement: "Bank statement",
  company_registry: "Company registry",
  source_of_funds: "Source of funds",
  unknown: "Unknown",
};

const LLM_LABEL = {
  fixture: "Narrative node is on fixtures. No model key is set.",
  openai: "Narrative node will call OpenAI for wording only. The policy table still sets the tier.",
  azure: "Narrative node will call Azure OpenAI for wording only. The policy table still sets the tier.",
} as const;

export function CaseBoard() {
  const router = useRouter();
  const { data } = useBreakers();
  const [cases, setCases] = useState<CaseSummary[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void fetch("/api/cases", { cache: "no-store" })
      .then(async (response) => {
        const body = (await response.json()) as { cases?: CaseSummary[]; error?: string };
        if (!response.ok) throw new Error(body.error || "Could not load case folders");
        if (!cancelled) setCases(body.cases ?? []);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load case folders");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function start(caseId: string) {
    setBusy(caseId);
    setError(null);
    try {
      const response = await fetch("/api/runs", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ caseId }),
      });
      const body = (await response.json()) as { run?: { runId: string }; error?: string };
      if (!response.ok || !body.run) throw new Error(body.error || "Could not open a run");
      sessionStorage.setItem(`ucdr:run:${body.run.runId}`, JSON.stringify(body.run));
      router.push(`/runs/${body.run.runId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not open a run");
      setBusy(null);
    }
  }

  return (
    <section>
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-signal">Named case folders · v1</p>
      <div className="mt-3 h-[3px] w-11 bg-signal" />
      <h1 className="mt-4 font-display text-5xl uppercase leading-none sm:text-6xl">Case board</h1>
      <p className="mt-4 max-w-3xl text-lg leading-snug">
        Three fictional packs. The route you see is computed from the policy table and the breaker strip, not from the
        label on the card.
      </p>
      <p className="mt-3 font-mono text-xs uppercase tracking-[0.08em] text-navy">
        {data ? LLM_LABEL[data.llmMode] : "Checking narrative mode…"}
      </p>
      {error ? <p className="mt-3 text-sm text-signal">{error}</p> : null}
      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {cases.map((folder) => (
          <article key={folder.caseId} className="flex flex-col border-[1.5px] border-ink bg-paper">
            <div className="flex items-start justify-between gap-3 border-b border-line px-4 py-3">
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.1em] text-signal">{folder.demoScript}</p>
              <p className="font-mono text-[0.68rem] text-navy">{folder.caseId}</p>
            </div>
            <div className="flex flex-1 flex-col gap-3 p-4">
              <h2 className="font-display text-3xl uppercase leading-none">{folder.title}</h2>
              <p className="text-sm leading-relaxed">{folder.blurb}</p>
              <p className="font-mono text-[0.68rem] uppercase tracking-[0.06em] text-muted">
                {folder.subjectLabel}
                <br />
                {folder.folderPath}
              </p>
              <ul className="space-y-1 text-sm">
                {folder.documents.map((doc) => (
                  <li key={doc.docId} className="flex justify-between gap-3 border-b border-line/80 py-1">
                    <span>{doc.fileName}</span>
                    <span className="font-mono text-[0.65rem] uppercase text-navy">
                      {DOC_LABEL[doc.classifiedType] ?? doc.classifiedType}
                    </span>
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void start(folder.caseId)}
                disabled={busy !== null}
                className="mt-auto border border-navy bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-ink disabled:opacity-60"
              >
                {busy === folder.caseId ? "Opening run…" : "Run this folder"}
              </button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
