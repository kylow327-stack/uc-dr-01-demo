import type { Metadata } from "next";
import { Barlow, Barlow_Condensed, DM_Mono } from "next/font/google";
import { DemoShell } from "@/components/DemoShell";
import "./globals.css";

const barlow = Barlow({
  subsets: ["latin"],
  weight: ["500", "600"],
  variable: "--font-barlow",
});

const condensed = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700"],
  variable: "--font-barlow-condensed",
});

const mono = DM_Mono({
  subsets: ["latin"],
  weight: ["500"],
  variable: "--font-dm-mono",
});

export const metadata: Metadata = {
  title: "UC-DR-01 · Bank doc-risk GenAI demo",
  description:
    "Clickable interview demo of a document completeness and risk-flagging agent. Fixture packs, policy-table tiers, HITL, and circuit breakers. Not a live bank system.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${condensed.variable} ${mono.variable}`}>
      <body className="font-sans text-base font-medium antialiased">
        <DemoShell>{children}</DemoShell>
      </body>
    </html>
  );
}
