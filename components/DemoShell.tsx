"use client";

import Link from "next/link";
import { BreakerProvider, BreakerStrip } from "@/components/BreakerBar";

export function DemoShell({ children }: { children: React.ReactNode }) {
  return (
    <BreakerProvider>
      <div className="min-h-screen">
        <header className="mx-auto flex max-w-page items-baseline justify-between gap-4 px-4 pt-5 font-mono text-[0.72rem] uppercase tracking-[0.08em]">
          <Link href="/" className="border-b border-line text-navy hover:border-signal">
            UC-DR-01
          </Link>
          <p className="text-right text-muted">Interview demo · fixtures only · not a bank system</p>
        </header>
        <BreakerStrip />
        <main className="mx-auto max-w-page px-4 pb-8 pt-8">{children}</main>
        <footer className="mx-auto max-w-page px-4 pb-10">
          <div className="border border-ink bg-stone px-4 py-3 text-sm leading-relaxed">
            <p className="font-mono text-[0.68rem] uppercase tracking-[0.12em] text-signal">
              Illustrative · design estimates · not measured KPIs
            </p>
            <p className="mt-2">
              FMEA scores, RPN figures, and breaker signals on this demo are design estimates. They are not live bank
              telemetry and not a production claim. The packets are simulated. A soft flag never clears a regulatory
              obligation. Timeout goes to quarantine and never approves. Reference gates are pending or not started.
            </p>
          </div>
        </footer>
      </div>
    </BreakerProvider>
  );
}
