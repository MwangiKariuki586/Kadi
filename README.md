# Kadi — Kenyan Card Game (PWA)

A lightweight, offline-first Kenyan Kadi card game: solo play vs smart on-device bots.
No account, no server, no network needed after first load.

## Features

- Solo play vs 1–3 bots (Easy / Medium / Hard) with a pure-TypeScript rules engine
- Tap-to-play combos (tap cards in order, then Play); invalid plays explain themselves inline
- Event feed is the single in-game channel (auto-consequences plus dead-tap notices); toasts survive only for Home/Settings confirmations
- Quit-safe: every move is persisted, refresh or HMR reload drops you back at the table
- Responsive from phone to desktop: centred pages on tablets, an immersive seat ring and
  bottom action rail on laptops, and a live match-log rail on wide screens
- Installable PWA (offline precache, auto-update, standalone, any orientation)
- Zero-asset media: WebAudio-synthesized SFX, inline-SVG cards, haptics via `navigator.vibrate`

## Tech stack

Vite 8 + TypeScript (strict) + Preact 10 + Tailwind CSS 4, PWA via `vite-plugin-pwa`
(Workbox), storage via `idb-keyval`, tests via Vitest and Playwright.

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
| `npm run test:e2e` | Run Playwright across six viewports      |

## Tests

195 Vitest tests across engine (validator incl. exhaustive proof), bots (incl.
legality fuzz), narration feed, store resume guards, and responsive seat
placement. `npm run test:e2e` adds Playwright smoke coverage for six viewports
(phone portrait/landscape, tablet portrait/landscape, laptop, wide desktop),
checking page breakpoints, the seat ring, the bottom action rail, and the feed
rail. `npm run build` also type-checks strictly, so green tests + green build =
shippable.

## Project structure

```
src/engine/  cards, rules (versioned RulesConfig), state, validator  <- pure TS, UI-free
src/bots/    easy / medium / hard bot policies
src/store/   GameStore interface + LocalStore (idb-keyval)
src/ui/      components, layout, feed narration, sounds, haptics
src/app.tsx  screens + table wiring (only stateful layer)
e2e/         Playwright responsive smoke tests
```

The engine never hardcodes card meanings — behaviour comes from a versioned
`RulesConfig`, so house rules are data, not code. UI touches storage only through
the `GameStore` interface.

## CI/CD

Every change goes through a pull request against `main` (see `AGENTS.md`).
PRs must pass lint, typecheck, unit tests, Playwright e2e, and build. Merges to
`main` auto-deploy staging; production is promoted from a validated staging
deployment — same artifact, never rebuilt.

## Docs

- `AGENTS.md` — development workflow (branching, PRs, CI, environments)
- `CONTEXT.md` — product context, locked decisions, architecture, open items
