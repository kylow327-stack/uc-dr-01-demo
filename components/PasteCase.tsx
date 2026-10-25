"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CaseSummary } from "@/lib/dto";
import type { RunState } from "@/lib/types";

interface FieldError {
  path: string;
  message: string;
}

export function PasteCase() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [errors, setErrors] = useState<FieldError[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState<"template" | "run" | null>(null);

  async function loadTemplate() {
    setBusy("template");
    setErrors([]);
    setFormError(null);
    try {
      const response = await fetch("/api/cases/template", { cache: "no-store" });
      const body = (await response.json()) as { template?: unknown; error?: string };
      if (!response.ok || !body.template) throw new Error(body.error || "Could not load the example template");
      setText(JSON.stringify(body.template, null, 2));
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not load the example template");
    } finally {
      setBusy(null);
    }
  }

  async function runPasted() {
    setBusy("run");
    setErrors([]);
    setFormError(null);
    try {
      if (text.trim() === "") {
        setErrors([{ path: "$", message: "Paste a case JSON object, or load the example template." }]);
        return;
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(text) as unknown;
      } catch {
        setErrors([{ path: "$", message: "JSON is not valid. Check commas, quotes, and brackets." }]);
        return;
      }
      const response = await fetch("/api/runs", {
        method: "POST",
        cache: "no-store",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ case: parsed }),
      });
      const body = (await response.json()) as {
        run?: RunState;
        folder?: CaseSummary;
        error?: string;
        fields?: FieldError[];
      };
      if (!response.ok || !body.run) {
        if (Array.isArray(body.fields) && body.fields.length > 0) setErrors(body.fields);
        setFormError(body.error || "Could not open a run from this JSON.");
        return;
      }
      const caseId = body.folder?.caseId ?? body.run.caseId;
      sessionStorage.setItem(`ucdr:case:${caseId}`, JSON.stringify(parsed));
      sessionStorage.setItem(`ucdr:run:${body.run.runId}`, JSON.stringify(body.run));
      router.push(`/runs/${body.run.runId}`);
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Could not open a run from this JSON.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section className="mt-14">
      <p className="font-mono text-[0.72rem] uppercase tracking-[0.14em] text-signal">Portal intake</p>
      <div className="mt-3 h-[3px] w-11 bg-signal" />
      <h2 className="mt-4 font-display text-4xl uppercase leading-none sm:text-5xl">Paste sample case</h2>
      <p className="mt-4 max-w-3xl text-sm leading-relaxed">
        Paste a fictional case pack as JSON. The shape matches the three demo folders. Load the example to start from a
        CASE-2041-shaped pack with id <span className="font-mono text-navy">CASE-PASTE</span>. The policy table still
        sets the tier. A soft flag does not clear an obligation. Timeout still quarantines.
      </p>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => void loadTemplate()}
          disabled={busy !== null}
          className="border border-ink px-4 py-2 text-sm font-semibold hover:border-signal disabled:opacity-60"
        >
          {busy === "template" ? "Loading template…" : "Load example template"}
        </button>
        <button
          type="button"
          onClick={() => void runPasted()}
          disabled={busy !== null}
          className="border border-navy bg-navy px-4 py-2 text-sm font-semibold text-paper hover:bg-ink disabled:opacity-60"
        >
          {busy === "run" ? "Opening run…" : "Run pasted case"}
        </button>
      </div>
      <label htmlFor="paste-case" className="mt-4 block font-mono text-[0.68rem] uppercase tracking-[0.08em] text-navy">
        Case JSON
      </label>
      <textarea
        id="paste-case"
        value={text}
        onChange={(event) => setText(event.target.value)}
        spellCheck={false}
        rows={18}
        placeholder='{ "caseId": "CASE-PASTE", "folderPath": "cases/allow/CASE-PASTE-sample", "profile": "individual_onboarding" }'
        className="mt-2 w-full border-[1.5px] border-ink bg-paper px-3 py-2 font-mono text-xs leading-relaxed"
      />
      {formError ? <p className="mt-3 text-sm text-signal">{formError}</p> : null}
      {errors.length > 0 ? (
        <ul className="mt-3 space-y-1 border border-signal bg-stone px-3 py-2 text-sm">
          {errors.map((field) => (
            <li key={`${field.path}:${field.message}`}>
              <span className="font-mono text-xs text-navy">{field.path}</span> {field.message}
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
