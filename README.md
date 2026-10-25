# UC-DR-01 demo

Clickable interview prototype of the [UC-DR-01 bank doc-risk operating model](https://ricklow.ai/uc-dr-01/).

For each named case folder, the agent flags document gaps and risk before a human or a soft path writes a **simulated** Case/GRC packet. This is not a live bank system, not a production deployment, and not connected to a real Case/GRC system of record.

FMEA scores, RPN figures, and breaker signals (`ex: …`) are **design estimates / illustrative telemetry**. They are not measured production KPIs. No gate in the reference design is treated as signed off.

## Hard rules the demo enforces

- Timeout moves the case to quarantine. It never approves.
- Risk tier comes from the policy table in `lib/policy/score.ts` only. The narrative model cannot set it.
- Soft path is low tier plus a complete PACK-v1 pack, and only while every circuit breaker is closed.
- A soft flag is a non-clearing mark. `clearsRegulatoryObligation` is always `false`.

## Run locally

```bash
npm install
npm test
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run build` then `npm start` serves the production build.

The default path is fixtures only. No API key is required.

## Demo script (about three minutes)

1. **Case board (20s).** Read the footer disclaimer. The breaker strip starts from the illustrative design states: five closed, `CB-CONFIDENCE` half-open. Half-open does not turn the soft path off. The example signals do not change when you click; the click only cycles the demo state.
2. **Soft path (60s).** Run `CASE-2041`. Use **Step node** through intake (`CP-INTAKE`), classify (`CP-CLS`), extract (`CP-EXT`), completeness (`CP-GAP`, `CP-HOOK`), and the grounded summary (`CP-LLM`). Point at the citation ids. The summary does not choose the tier. **Run to decision** finishes score (`CP-SCORE`) and the simulated write. Open **SoR packet**. The navy panel says the flag does not clear the obligation, and `clearsRegulatoryObligation = false`.
3. **HITL and timeout (50s).** Back to the board. Run `CASE-2077` with **Run to decision**. Open **HITL interrupt**. The gap list shows a missing proof of address and a missing passport expiry. Tier is medium from `POL-05`. Click **Simulate timeout**. The result is quarantine, `approved = false`, and no packet. On a second run of the same folder you can instead Approve, Edit, Reject, or Escalate. Approve writes an analyst-accepted packet that is still non-clearing. Edit alone does not write.
4. **Breakers (40s).** Open any breaker (try `CB-CASE-WRITE`). Run `CASE-2041` again. The soft path is disabled and the case waits at HITL even though the tier stays low. Approve while that breaker is open freezes the write and does not approve. Open `CB-DATA-EGRESS` and step: the run is killed and a simulated security bridge opens. **Reset illustrative states** restores the design defaults. `CASE-2118` is the high tier: a field at 0.62, a name conflict, and a fixture elevated indicator (`POL-02`, `POL-03`, `POL-04`).

## Optional narrative model

Copy `.env.example` to `.env.local`. Leave it empty to stay on fixtures.

If `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_DEPLOYMENT` are all set, the summarize node calls that deployment. Otherwise, if `OPENAI_API_KEY` is set, it calls the public OpenAI chat completions API (`OPENAI_MODEL`, default `gpt-4o-mini`).

The model may only draft the briefing. Every factor must cite an id from the extract, a gap, or a fixture indicator. Uncited factors are dropped. A `tier` field on the model payload is ignored. If the call fails, the fixture briefing is used and the screen says `fixture_fallback`.

Do not point this public demo at real customer documents or live case folders, even when the endpoint is private. The packs under `fixtures/` are fictional.

## Live URL

Route handlers need a Node host. GitHub Pages cannot run them.

This copy was not deployed: the build environment had no Vercel token. To publish:

1. Merge this branch so `main` contains the app.
2. Import the GitHub repo at [vercel.com/new](https://vercel.com/new). Framework preset: Next.js. `vercel.json` already sets that.
3. Leave environment variables empty for the fixture path. Deploy.
4. The URL Vercel assigns is the live demo. Optional model keys belong in the Vercel project settings, not in git.

Local check before you import:

```bash
npm install && npm test && npm run build
```

## Layout

| Path | What it is |
| --- | --- |
| `fixtures/` | Fictional case packs, PACK-v1, taxonomy, illustrative breaker defaults |
| `lib/policy/score.ts` | Deterministic tier table (`CP-SCORE`) |
| `lib/graph/engine.ts` | In-memory LangGraph-shaped steps, HITL, timeout, breaker degrade |
| `app/api/runs/` | Route handlers: start, step, play, HITL, timeout, restore |
| `/` | Case board, policy table, controls, illustrative FMEA, gates |
| `/runs/[runId]` | Step-through run view |
| `/runs/[runId]/packet` | Non-clearing SoR preview |
| `/runs/[runId]/hitl` | Approve / edit / reject / escalate, and timeout → quarantine |

Run state is kept in memory on the server instance. The browser also stores the latest run and breaker states in `sessionStorage` and restores them if the instance is cold.

## Not in this prototype

- No live Langfuse project. Trace ids are simulated (`lf-demo-…`).
- No real Case/GRC write, Document Intelligence, or private network.
- No rework edge back to classify.
- Breaker percentages do not come from a metrics backend. The strip is a demo control with the published example signals.
- The optional model path is implemented and untested here, because no key was configured.
