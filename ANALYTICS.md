# Analytics & privacy

Kadi uses [PostHog](https://posthog.com/) for anonymous product analytics and
session replay. Analytics is optional, opt-out, and never blocks gameplay.
Gameplay works fully offline; analytics requests only happen when the device is
online.

## What is collected

Explicit events only. There is no autocapture, no pageview tracking, no
heatmaps, no surveys, and no error tracking.

| Event | When | Properties |
|---|---|---|
| `app_opened` | After boot settings load | `display_mode`, `online`, `has_saved_game`, `resumed` |
| `screen_viewed` | Screen change | `screen` |
| `game_started` | New deal | `bots`, `difficulty`, `preset`, `jokers`, `super_ace`, `strict` |
| `game_resumed` | Continue or boot resume | game config + `turns` |
| `game_left` | Quit to Home | game config + `saved`, `turns` |
| `game_finished` | Game over | game config + `won`, `turns`, `duration_ms`, `moves`, `picks`, `invalid_plays`, `kadi_calls`, `false_kadi`, `resumed` |
| `move_played` | Successful human play | `card_count`, `turn`, `penalty_answer`, `kept_turn` |
| `cards_picked` | Human pick/draw | `count`, `skipped`, `turn` |
| `invalid_play` | Rejected human play | `reason`, `card_count`, `strict`, `turn` |
| `kadi_called` | Human KADI call | `late`, `turn`, `winnable` |
| `kadi_false` | False KADI | `turn`, `fined` |
| `bot_stall` | Bot produced an invalid move (tripwire) | `difficulty`, `card_count`, `turn` |
| `setting_changed` | Setting toggled | `key`, `value` |
| `custom_rules_saved` | Rules builder save | `editing` |
| `custom_rules_deleted` | Rules builder delete | `editing` |
| `settings_action` | Reset/clear action | `action` |
| `install_prompt_result` | Install prompt outcome | `outcome`, `placement` |
| `install_dismissed` | "Not now" on install card | `placement` |

Every event also carries `deployment_host` (the hostname serving the app) so
staging and production can share one PostHog project.

`preset` is always one of `standard_maua`, `bom_ni_bom`, `backstreet_pesa`, or
`custom`. Custom rule names are never sent.

## What is never sent as event properties

- Player names or any free text
- Custom rule names, descriptions, or share codes
- Card IDs, hands, or deck contents
- IP addresses (`ip: false` in the SDK config)
- Person profiles (`person_profiles: 'never'`; events are anonymous)
- Autocaptured clicks, pageviews, heatmaps, surveys, exceptions, or web vitals

Session replay is a visual recording of the screen, so it shows the table, card
faces, bot names, and scores. Inputs, custom rule names/descriptions, and
share/import codes are masked. Treat replay as screen capture, not as a separate
analytics feed.

## Identity and opt-out

Kadi stores a random first-party anonymous ID in `localStorage` so funnels and
retention work across visits. It is not linked to a person.

Settings → Privacy → **Usage stats & replays** controls analytics:

- **On (default):** anonymous events and session replays are sent when online.
- **Off:** PostHog is not initialized on future boots, buffered replay is
  discarded without flushing, capture is opted out, queued SDK requests and the
  offline outbox are cleared, and the anonymous ID is reset. Once consent is
  withdrawn, no further requests are sent.

The SDK also starts opted out by default and is explicitly opted in only while
the app setting is on, so resetting consent can never silently re-enable capture.
No `$opt_in` event is sent.

Events are sent immediately instead of being batched, so a queued batch cannot
flush after the setting is switched off.

The app also stays silent when the browser sends Do Not Track, or when
`navigator.webdriver` is true (Playwright/browser automation).

## Session replay masking

Session replay is enabled with:

- `maskAllInputs: true` — every input and textarea value is masked.
- `maskTextSelector: '[data-ph-mask]'` — custom rule names/descriptions and
  other user-generated labels are masked in the DOM.
- `recordBody: false`, `recordHeaders: false` — network payloads are not
  recorded.
- No console logs are recorded.

Replay needs PostHog's `/flags` endpoint. Flags stay enabled while analytics is
on; opting out disables remote flags before resetting so the toggle cannot fire a
`/flags` request, and opting back in re-enables them.

## Offline behaviour

`posthog-js` retries from memory, but an offline PWA can be closed before the
network returns. Kadi keeps a capped outbox (100 events) in `localStorage`:

- Events are queued while offline or before the lazy SDK chunk loads.
- The queue flushes in order after initialization and on the browser `online`
  event.
- The oldest event is dropped when the cap is reached.
- Opting out clears the queue.
- Session replay cannot be captured offline; recordings resume when online.

## PostHog project setup

1. Use a **US Cloud** project and copy the project API key (`phc_...`).
2. Enable **Session Replay**.
3. Turn off autocapture, surveys, heatmaps, error tracking, and web vitals in
   the project settings. The SDK config also disables them.
4. Set a **billing limit** so the free tier cannot be exceeded unexpectedly.
5. Optionally start replay at 100% of sessions and lower it if you approach the
   monthly recording limit.
6. Add the staging and production domains to the replay authorized domains if
   that setting is present.

## Environment variables

Add these to Vercel for **Preview and Production**:

```
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
```

For local development, create `.env.local` (gitignored):

```
VITE_POSTHOG_KEY=phc_...
VITE_POSTHOG_HOST=https://us.i.posthog.com
VITE_POSTHOG_DEV=true
```

Local dev is silent unless `VITE_POSTHOG_DEV=true`. CI and Playwright builds
have no key and stay silent. See `.env.example`.

## Bundle and PWA behaviour

`posthog-js` is imported dynamically and split into a separate `analytics-*.js`
chunk. Workbox excludes that chunk from the precache, so the installed app does
not download analytics until it is online and analytics is enabled.

## Useful PostHog insights

- Overview: unique users, games started/finished, completion rate, win rate,
  average turns and duration.
- Breakdowns: difficulty, bot count, preset, standalone vs browser, online vs
  offline.
- Funnel: `app_opened` → `screen_viewed(lobby)` → `game_started` →
  `game_finished`.
- KADI: calls, false calls, late calls; filter replays by `kadi_false`.
- UX: invalid plays by reason, picks per game, install funnel.
- Replay filters: `game_finished` with `won=false`, `kadi_false`,
  `invalid_play`, or `display_mode=standalone`.
- Alert on any `bot_stall`.

Because events are anonymous, trends/funnels/retention by distinct ID work, but
lifecycle insights and person properties do not.

## Verification

Unit tests cover config resolution (missing key, dev guard, DNT, automation),
the outbox (cap, order, failure, opt-out), event mapping, and privacy defaults.
The Playwright suite checks that the Settings toggle persists across reloads.

To verify manually:

1. Set `.env.local` with `VITE_POSTHOG_DEV=true` and run `npm run dev`.
2. Check PostHog Activity for `app_opened`, `screen_viewed`, and `game_started`.
3. Play a game and confirm replay appears with inputs/custom names masked.
4. Turn analytics off and confirm no PostHog requests in DevTools.
5. Go offline, play a few moves, reconnect, and confirm queued events arrive.
