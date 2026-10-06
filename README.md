# Kadi — Kenyan Card Game (PWA)

A lightweight, offline-first Kenyan Kadi card game: solo play vs smart on-device bots.
No account, no server, no network needed after first load.

## Features

- Solo play vs 1–3 bots (Easy / Medium / Hard) with a pure-TypeScript rules engine
- Tap-to-play combos (tap cards in order, then Play); invalid plays explain themselves inline
- Event feed narrates every auto-consequence (debts, blocks, skips, reverses, demands, wins)
- Quit-safe: every move is persisted, refresh or HMR reload drops you back at the table
- Installable PWA (offline precache, auto-update, portrait standalone)
- Zero-asset media: WebAudio-synthesized SFX, inline-SVG cards, haptics via `navigator.vibrate`

## Tech stack

Vite 8 + TypeScript (strict) + Preact 10 + Tailwind CSS 4, PWA via `vite-plugin-pwa`
(Workbox), storage via `idb-keyval`, tests via Vitest.

## Getting started

Requires Node 22+.

```sh
npm install
npm run dev        # http://localhost:5173 with HMR
```

Phone testing on the same Wi-Fi: `npm run dev -- --port 5173 --strictPort --host`
(one-time admin firewall rule for TCP 5173; the LAN IP is printed in the terminal).

## Scripts

| Command           | What it does                              |
|-------------------|-------------------------------------------|
| `npm run dev`     | Start dev server with HMR                 |
| `npm run build`   | Strict `tsc -b` + production Vite build   |
| `npm run preview` | Serve the production `dist/` locally      |
| `npm test`        | Run the Vitest suite once                 |
| `npm run test:watch` | Run Vitest in watch mode               |

## Tests

91 Vitest tests across engine (validator incl. exhaustive proof), bots (incl.
legality fuzz), narration feed, and store resume guards. `npm run build` also
type-checks strictly, so green tests + green build = shippable.

## Project structure

```
src/engine/  cards, rules (versioned RulesConfig), state, validator  <- pure TS, UI-free
src/bots/    easy / medium / hard bot policies
src/store/   GameStore interface + LocalStore (idb-keyval)
src/ui/      components, feed narration, sounds, haptics
src/app.tsx  screens + table wiring (only stateful layer)
```

The engine never hardcodes card meanings — behaviour comes from a versioned
`RulesConfig`, so house rules are data, not code. UI touches storage only through
the `GameStore` interface.

## CI/CD

Every change goes through a pull request against `main` (see `AGENTS.md`).
PRs must pass lint, typecheck, unit tests, and build. Merges to `main`
auto-deploy staging; production is promoted from a validated staging deployment
— same artifact, never rebuilt.

## Docs

- `AGENTS.md` — development workflow (branching, PRs, CI, environments)
- `CONTEXT.md` — product context, locked decisions, architecture, open items
