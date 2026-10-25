"use client";

import { useCallback, useEffect, useState } from "react";
import type { CaseSummary, RunResponse } from "@/lib/dto";
import type { RunState } from "@/lib/types";

export function useRun(runId: string) {
  const [run, setRun] = useState<RunState | null>(null);
  const [folder, setFolder] = useState<CaseSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [pending, setPending] = useState(true);

  const remember = useCallback((body: RunResponse, advanced?: boolean) => {
    sessionStorage.setItem(`ucdr:run:${body.run.runId}`, JSON.stringify(body.run));
    setRun(body.run);
    setFolder(body.folder);
    if (advanced === false) {
      setNote("Nothing new to run. The graph is paused, waiting, or already finished.");
    } else {
      setNote(null);
    }
  }, []);

  const load = useCallback(async () => {
    setPending(true);
    setError(null);
    try {
      let response = await fetch(`/api/runs/${runId}`, { cache: "no-store" });
      if (response.status === 404) {
        const cached = sessionStorage.getItem(`ucdr:run:${runId}`);
        if (!cached) {
          throw new Error("This run is not on this server instance. Start the folder again from the case board.");
        }
        response = await fetch("/api/runs/restore", {
          method: "POST",
          cache: "no-store",
          headers: { "content-type": "application/json" },
          body: cached,
        });
      }
      const body = (await response.json()) as RunResponse & { error?: string };
      if (!response.ok) throw new Error(body.error || "Could not load the run");
      remember(body);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load the run");
    } finally {
      setPending(false);
    }
  }, [remember, runId]);

  useEffect(() => {
    void load();
  }, [load]);

  const act = useCallback(
    async (path: string, init?: RequestInit) => {
      setPending(true);
      setError(null);
      try {
        const response = await fetch(path, {
          cache: "no-store",
          ...init,
          headers: { "content-type": "application/json", ...(init?.headers ?? {}) },
        });
        const body = (await response.json()) as RunResponse & { error?: string };
        if (!response.ok) throw new Error(body.error || "Request failed");
        remember(body, body.advanced);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Request failed");
      } finally {
        setPending(false);
      }
    },
    [remember],
  );

  return { run, folder, error, note, pending, act };
}
