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

`npm run build` then `npm start` serves the production build. The build also checks that every `fixtures/**/*.json` file is in each `/api` function trace and that the case, pack, and breaker payloads are inlined in the server bundles. See [Live URL](#live-url) for the `POST /api/runs` check against that production server.

The default path is fixtures only. No API key is required.

## Demo script (about four minutes)

1. **Case board (20s).** Read the footer disclaimer. The breaker strip starts from the illustrative design states: five closed, `CB-CONFIDENCE` half-open. Half-open does not turn the soft path off. The example signals do not change when you click; the click only cycles the demo state.
2. **Soft path (60s).** Run `CASE-2041`. Use **Step node** through intake (`CP-INTAKE`), classify (`CP-CLS`), extract (`CP-EXT`), completeness (`CP-GAP`, `CP-HOOK`), and the grounded summary (`CP-LLM`). Point at the citation ids. The summary does not choose the tier. **Run to decision** finishes score (`CP-SCORE`) and the simulated write. Open **SoR packet**. The navy panel says the flag does not clear the obligation, and `clearsRegulatoryObligation = false`.
3. **HITL and timeout (50s).** Back to the board. Run `CASE-2077` with **Run to decision**. Open **HITL interrupt**. The gap list shows a missing proof of address and a missing passport expiry. Tier is medium from `POL-05`. Click **Simulate timeout**. The result is quarantine, `approved = false`, and no packet. On a second run of the same folder you can instead Approve, Edit, Reject, or Escalate. Approve writes an analyst-accepted packet that is still non-clearing. Edit alone does not write.
4. **Breakers (40s).** Open any breaker (try `CB-CASE-WRITE`). Run `CASE-2041` again. The soft path is disabled and the case waits at HITL even though the tier stays low. Approve while that breaker is open freezes the write and does not approve. Open `CB-DATA-EGRESS` and step: the run is killed and a simulated security bridge opens. **Reset illustrative states** restores the design defaults. `CASE-2118` is the high tier: a field at 0.62, a name conflict, and a fixture elevated indicator (`POL-02`, `POL-03`, `POL-04`).
5. **Paste (40s).** Under **Paste sample case**, load the example template and run it. The route matches the soft path above. Open **SoR packet** for the navy panel and the JSON. To show HITL, delete the proof-of-address document from the template and run again. See [Portal: paste a case](#portal-paste-a-case).

## Portal: paste a case

The case board keeps the three fictional folders. **Paste sample case** accepts JSON in the same shape as `fixtures/cases/`. **Load example template** fills a CASE-2041-shaped pack whose id is `CASE-PASTE`, so the built-in cards stay as they are. A valid paste is stored in server memory and in the browser session, then started through `POST /api/runs`. Step, play, HITL, timeout, and the packet page are the same screens as the demo folders. The packet page shows the readable panel and the JSON.

The tier still comes only from `lib/policy/score.ts`. With no model key, or if the model call fails, the summarize node writes a `fixture_fallback` briefing. A pasted `fixtureNarrative` is kept when every citation is on the extract, a gap, or an indicator. If those citations do not ground, the briefing is built from the pasted fields and gaps. Timeout still quarantines and does not approve. `clearsRegulatoryObligation` stays `false`. Soft path still requires a low tier, a complete pack, and no open breaker.

`caseId` must not be `CASE-2041`, `CASE-2077`, or `CASE-2118`. `folderPath` must be `cases/allow/` plus one segment of letters, numbers, dots, underscores, or hyphens. `profile` is `individual_onboarding` or `sme_onboarding`. `classifiedType` is `passport`, `proof_of_address`, `bank_statement`, `company_registry`, `source_of_funds`, or `unknown`.

```json
{
  "caseId": "CASE-PASTE",
  "folderPath": "cases/allow/CASE-PASTE-sample",
  "profile": "individual_onboarding",
  "title": "Pasted sample pack",
  "demoScript": "Paste · shaped like the low complete pack",
  "subjectLabel": "Alex Rivera (fictional sample)",
  "blurb": "Short description shown on the run.",
  "identityConflict": false,
  "conflictNote": null,
  "elevatedIndicators": [],
  "documents": [
    {
      "docId": "DOC-PASSPORT-01",
      "fileName": "passport-sample.pdf",
      "classifiedType": "passport",
      "pages": 1,
      "fields": [
        { "id": "full_name", "label": "Full name", "value": "Alex Rivera (fictional sample)", "confidence": 0.98, "page": 1 }
      ]
    }
  ],
  "fixtureNarrative": {
    "summary": "Grounded briefing. It does not assign a tier.",
    "factors": [
      {
        "id": "RF-01",
        "text": "The passport extract has a full name.",
        "citations": ["cite:CASE-PASTE:DOC-PASSPORT-01:full_name"]
      }
    ]
  }
}
```

## Optional narrative model

Copy `.env.example` to `.env.local`. Leave it empty to stay on fixtures.

If `AZURE_OPENAI_ENDPOINT`, `AZURE_OPENAI_API_KEY`, and `AZURE_OPENAI_DEPLOYMENT` are all set, the summarize node calls that deployment. Otherwise, if `OPENAI_API_KEY` is set, it calls the public OpenAI chat completions API (`OPENAI_MODEL`, default `gpt-4o-mini`).

The model may only draft the briefing. Every factor must cite an id from the extract, a gap, or a fixture indicator. Uncited factors are dropped. A `tier` field on the model payload is ignored. If the call fails, the fixture briefing is used and the screen says `fixture_fallback`.

Do not point this public demo at real customer documents or live case folders, even when the endpoint is private. The packs under `fixtures/` are fictional.

## Live URL

Route handlers need a Node host. GitHub Pages cannot run them.

Production is already deployed:

- https://uc-dr-01-demo-rick-13ff.vercel.app
- https://uc-dr-01-demo.vercel.app

Redeploy after this fix lands on `main`. The previous production build answered `POST /api/runs` with `ENOENT` for `/var/task/fixtures/pack-v1.json`, and the breaker strip failed the same way. `lib/fixtures.ts` now statically imports every fixture, so Webpack inlines the JSON into the Node server bundle. `outputFileTracingIncludes` in `next.config.ts` also copies `./fixtures/**/*.json` onto every server function (`/**`, which covers `/api/**` and `/runs/**`). A cold start can read the payload from the bundle even when the function filesystem has not been traced.

Leave environment variables empty for the fixture path. No API key is required. Optional model keys belong in the Vercel project settings, not in git.

### Verify `POST /api/runs` locally after the production build

```bash
npm install
npm test
npm run build
npm start
```

`npm run build` exits non-zero if an API route trace is missing a fixture file, or if the runs, cases, or breakers bundles do not contain the inlined fixture text.

In a second shell, against that production server:

```bash
curl -sS -X POST http://localhost:3000/api/runs \
  -H 'content-type: application/json' \
  -d '{"caseId":"CASE-2041"}'
```

A working build returns a JSON run for `CASE-2041` with `phase` `ready`. Then:

```bash
curl -sS http://localhost:3000/api/cases
curl -sS http://localhost:3000/api/breakers
```

The case list includes `CASE-2041`, `CASE-2077`, and `CASE-2118`. The breaker payload includes the six illustrative breakers, with `CB-CONFIDENCE` half-open.

## Layout

| Path | What it is |
| --- | --- |
| `fixtures/` | Fictional case packs, PACK-v1, taxonomy, illustrative breaker defaults. Statically imported by `lib/fixtures.ts` and included in the Vercel function trace |
| Paste sample case | Portal intake on the case board. JSON in the fixture shape, then the same run, HITL, and packet pages |
| `lib/policy/score.ts` | Deterministic tier table (`CP-SCORE`) |
| `lib/graph/engine.ts` | In-memory LangGraph-shaped steps, HITL, timeout, breaker degrade |
| `app/api/runs/` | Route handlers: start, step, play, HITL, timeout, restore |
| `/` | Case board, paste intake, policy table, controls, illustrative FMEA, gates |
| `/runs/[runId]` | Step-through run view |
| `/runs/[runId]/packet` | Non-clearing SoR preview, readable panel and JSON |
| `/runs/[runId]/hitl` | Approve / edit / reject / escalate, and timeout → quarantine |

Run state is kept in memory on the server instance, along with any pasted case pack. The browser also stores the latest run, the pasted case JSON, and breaker states in `sessionStorage` and restores them if the instance is cold.

## Not in this prototype

- No live Langfuse project. Trace ids are simulated (`lf-demo-…`).
- No real Case/GRC write, Document Intelligence, or private network.
- No rework edge back to classify.
- Breaker percentages do not come from a metrics backend. The strip is a demo control with the published example signals.
- The optional model path is implemented and untested here, because no key was configured.
