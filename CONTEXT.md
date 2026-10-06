# Kadi — Context Document

**What:** A lightweight, offline-first Kenyan Kadi card game (PWA) — solo vs smart bots.
**Why:** No working Kadi app exists for Kenyan youth; existing ones are broken. Goals: (1) a new
challenge when alone, (2) playable with no friends around (bots simulate 1–3 opponents).
**Status:** Playable v1 on `http://localhost:5173` (dev, HMR) and LAN `http://192.168.100.8:5173`.
Verified: **91/91 Vitest green, `tsc -b` clean, production build ~91 KB precached.**

---

## 1. Cost decisions (locked before any code)

| Item | Decision | Cost |
|---|---|---|
| Distribution | PWA first; Play Store later via Capacitor/TWA wrapper | $0 now, $25 one-time later |
| iOS | Skipped for v1 (audience ~90% Android) | saves $99/yr |
| Backend v1 | None — solo vs on-device bots, IndexedDB storage | $0/mo |
| Backend v2 (online) | Supabase free tier → Pro $25/mo only if traction demands it | $0 until growth |
| Year-1 total (offline) | Domain optional | ~3,250–5,200 KES |

Key insight: online multiplayer is the only cost driver, so it was deferred. Solo + pass-and-play
need no server.

## 2. Tech stack (locked)

* **Vite 8 + TypeScript + Preact 10 + Tailwind 4** — Preact is API-identical React at ~3 KB;
  production JS is ~16 KB gzip. No game engine: DOM + CSS transforms only.
* **PWA** via `vite-plugin-pwa` (Workbox, auto-update, standalone portrait, offline precache).
  Capacitor-ready for a future store wrapper (Capacitor itself is free/MIT).
* **Zero-asset media:** WebAudio-synthesized SFX (no mp3s), inline-SVG cards incl. a red/black
  Jester illustration, `navigator.vibrate` haptics. Total precache stays < 100 KB.
* **Storage:** `idb-keyval` (stats, settings, custom rules, live-game saves).
* **Tests:** Vitest (`npm test`), strict `tsc -b` on every build.

## 3. Architecture

```
src/engine/  cards.ts, rules.ts (RulesConfig), state.ts, validator.ts   ← pure TS, UI-free
src/bots/    bot.ts (easy/medium/hard), bot.test.ts
src/store/   local.ts (GameStore interface + LocalStore, idb-keyval)
src/ui/      components.tsx, feed.ts (narration), sounds.ts, haptics.ts
src/app.tsx  screens + table + wiring (only stateful/impure layer)
```

Rules:
* The engine never hardcodes card meanings — everything reads a versioned **`RulesConfig`**
  (data, not code). New house rules = new fields + defaults; old profiles migrate.
* The engine is UI-free so the *same* validator can later run in an Edge Function for
  authoritative online validation.
* UI talks to storage only through the **`GameStore` interface** (`LocalStore` now,
  `SupabaseStore` later with the same shape).

## 4. Rules engine & locked ruleset (Standard Maua base)

Deck: 52 + 2 Jokers in Standard (Strict = Standard minus Jokers only). Deal 4 each. Starter is
never 2/3/J/Q/8/K/A/Joker. Win = dump the whole hand in one move ending on 4/5/6/7/9/10,
declared on a strictly earlier turn (`Niko Kadi`), no cardless blocker.

### Decision log (each debated during build)

1. **Penalty answers = penalty family + color.** A 2♥ is answered by any 2, same-suit 3♥,
   color-matched Joker, or Ace. Non-penalty cards can never answer. Joker colors derive from
   id (JOKER-1 red ↔ hearts/diamonds, JOKER-2 black ↔ spades/clubs); a Joker on top is
   answered by same-color-family penalties or Ace.
2. **No accumulation — top takes over.** Answering replaces the debt (Joker +5 answered by a
   2 → Pick 2; 2-on-2 stays 2). Flag: `penaltyAccumulates: false` (kept for legacy variants).
   Answering is still allowed (`allowPenaltyStacking` is the gate, unchanged).
3. **Ace: block vs request.** Ace onto a penalty is a *pure block* (neutralise, call nothing —
   per estate rules). Freely played Ace requests a suit; single-vs-single Ace chains keep
   last-declares-wins. The engine remembers the overridden suit (`lastSuitBeforeRequest`).
4. **Super aces.** Stacked 2+ aces are *inherently* super (exact-card demand, any preset).
   The lobby "Special Ace" toggle governs only the lone A♠. Responses: exact card satisfies;
   lone Ace *lifts the rank but the demanded suit persists* (responder never picks a suit);
   super answers super (counter-demand, last declares). Aces can never close a game.
5. **Bare questions are legal.** Q/8 (and 2P J/K-as-question) played without an answer draws
   `unansweredQuestionPickCount` (default 1) instead of being rejected.
6. **Tap order = combo order.** Combos evaluate in tap sequence (first must match top);
   selected cards show 1/2/3 badges. K/J stacks chain by suit-or-rank; next player follows
   the net calculation (J+J in 3P anti-clockwise returns to self; K+K restores direction).
   Bots try pairs in both orders.
7. **KADI! badge = declared AND finishable now.** `canFinishNow` (bounded permutation search,
   cap 7, recomputed per move) requires prior-turn declaration, no outstanding debts,
   a legal full-hand winning dump vs the current table, and no cardless blocker. Stops
   6-card "KADI!" ghosts. The Kadi! *button* stays free (declaring early is legal; the win
   still requires the earlier turn) — speech act vs verified threat are separate by design.
8. **No win without the call — late calls fined.** Clean dumps without valid prior declaration:
   dump stands, win denied, draw `lateCallPickCount` (default 1) instead of wandering
   cardless. Non-winning dumps keep the legacy cardless path.
9. **Strict tables (opt-in).** Toggle (default off): illegal submissions stay tappable and are
   fined via the previously-dormant `penaliseIllegalPlay` (draw + turn passes). Casual tables
   keep protective disabled-Play + inline reason. Count reuses `invalidPlayPickCount`.
10. **Kadi! button kept manual.** Gating/auto-declaring were rejected: timing skill must mean
    something, and auto would gut the iconic callout (esp. for future human multiplayer).

## 5. Bots

1 human + 1–3 bots (2–4 seats, engine supports 5). Difficulties:
* **Easy** — mostly random legal moves, sometimes eats penalties it could answer.
* **Medium/Hard** — stack penalties, save Aces, pair Q+answers, shed max cards, attack close
  rivals with penalties/super aces, declare Kadi on winnable shape, demand cards they hold
  (single deck ⇒ unanswerable), meet exact demands when able else downgrade else draw.
* All bot moves are generated through `validateCombo`, so illegal bot moves are impossible by
  construction (fuzz-tested). A visible `🐞 stalls` tripwire narrates any rejected bot move
  instead of swallowing it, so future ghosts leave evidence.

## 6. UI/UX decisions

* **Tap-to-play** (tap in order → Play), no drag (reliable on low-end touch).
* **Invalid selections disable Play upfront** with the inline reason — no tap-to-discover.
* **Event feed, not toasts, narrates the table:** every auto-consequence is announced
  (`Pick 2 hangs over You (from 2♣)`, `lifts the rank — follow Clubs ♣`, eats/blocks/
  skips/reverses/demands/wins), latest two always visible, tap 📜 for history. Penalty lines
  name source cards; suit calls always name the previous suit. Toasts are reserved for
  illegal taps.
* **Turn coach is opt-in (default off):** contextual `turnCoach` line (debts → corrections →
  opportunities) behind Home's `💡 Hints` toggle. Default table shows only `👉 Your turn`.
* **Quit confirmation modal:** Quit → "Keep playing / Save & exit". Exiting preserves the game;
  Home offers Continue; starting fresh overwrites; game-over clears.
* **Auto-resume:** every committed move persists the full match; refresh/HMR reload lands
  straight back at the table, zero taps. Corrupt/version-stale saves fall back to Home.
* **Joker face:** inline-SVG jester in currentColor — red/black per Joker color, `+5` badge.
* **Super-ace picker** highlights held ranks/suits (★ + counts) since demanding what you hold
  is unanswerable; also used for the lone-special-ace mode.
* Portrait-first, thumb-reach layout, dark battery-saving theme, Sheng-flavored copy,
  `prefers-reduced-motion` respected, 48dp targets, safe-area insets.

## 7. Backend plan (v2, not built)

`GameStore` seam ready. When online is wanted: anonymous+nickname auth, 6-char rooms storing
`{ code, rulesConfig, state, turn }`, same TS validator in an Edge Function, Supabase Realtime
channels (~1 write/move for turn-based). Leaderboards/coins only on demand.

## 8. Verification

* 91 Vitest tests across 5 files (engine 58: 57 validator incl. an exhaustive proof that
  a broken chain fails in 5,000+ table states; bots 10 incl. 600-decision legality fuzz;
  feed 16 narration + coach; store 7 resume-guard + defaults). `tsc -b` strict-clean.
  `npm run build` green.
* Manual: dev on :5173, LAN-tested on phone via `--host` (needs one admin firewall rule —
  see below). Preview smoke-tested HTTP 200.

## 9. Dev workflow notes

* **One dev server:** `npm run dev -- --port 5173 --strictPort --host` (detached, logs to
  `.vite-dev.log`). Never open a new server per change — HMR hot-pushes. Phone testing needs
  same Wi-Fi + (one-time, admin terminal):
  `netsh advfirewall firewall add rule name="Kadi Vite Dev 5173" dir=in action=allow protocol=TCP localport=5173`.
  LAN IP is printed in `.vite-dev.log` (`Network:`) and can change on reconnect.
* **Known dead code (intentional):** `QUESTION_NEEDS_ANSWER` reason (open questions are legal
  now; kept for a possible strict-answers variant).
* **Open/unresolved:**
  1. *Ghost-move incident:* a `2♣ + 4♦` combo on 9♣ was once narrated as played although the
     engine provably rejects it (fuzz + exhaustive proof + full suite). Cause undetermined
     (prime suspect: pre-window hidden state or an HMR-spanning bot timeout; server/code
     verified current). Guard kept (`exhaustive.test.ts`) + `🐞 stalls` tripwire added.
     Still needs: event *before* the visible history window + fresh-game repro + Eat-button
     text (+2 vs +5) confirmation.
  2. *Bot tempo:* approved ~0.9–1.4s thinking (from 650–1000ms) to give humans declaration
     room without reminders — **not built** (see bot loop constant).
  3. *Capacitor wrapper + Play listing* ($25) — deferred.
  4. *Real PNG icons* — currently SVG placeholders (installable, but store-ready art pending).
  5. *Online multiplayer (v2)* — designed, not built. 
