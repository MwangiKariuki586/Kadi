# Analytics & privacy

Kadi uses [PostHog](https://posthog.com/) for anonymous product analytics and
sampled session replay. Analytics is intentionally lean: aggregate game outcomes
are recorded for every game, high-volume per-turn events are not, and only a
fraction of sessions are recorded. Analytics is optional, opt-out, and never
blocks gameplay. Gameplay works fully offline; analytics requests only happen
when the device is online.

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
| `invalid_play` | Rejected human play | `reason`, `card_count`, `strict`, `turn` |
| `kadi_called` | Human KADI call | `late`, `turn`, `winnable` |
| `kadi_false` | False KADI | `turn`, `fined` |
| `bot_stall` | Bot produced an invalid move (tripwire) | `difficulty`, `card_count`, `turn` |
| `setting_changed` | Setting toggled | `key`, `value` |
| `custom_rules_saved` | Rules builder save | `editing`, `base_preset`, `changed_count` |
| `custom_rule_changed` | One changed custom-rule field | `field`, `value`, `editing`, `base_preset` |
| `custom_rules_deleted` | Rules builder delete | `editing` |
| `settings_action` | Reset/clear action | `action` |
| `install_prompt_result` | Install prompt outcome | `outcome`, `placement` |
| `install_dismissed` | "Not now" on install card | `placement` |

Per-turn `move_played` and `cards_picked` events are intentionally not sent.
`game_finished` carries the totals (`moves`, `picks`), so aggregate metrics are
preserved while the event budget stays small. Use sampled replays for turn-by-turn
debugging.

Every event also carries `deployment_host` (the hostname serving the app) so
staging and production can share one PostHog project.

`preset` is always one of `standard_maua`, `bom_ni_bom`, `backstreet_pesa`, or
`custom`. Custom rule names are never sent.

Custom rules are reported as a structured diff, never as the saved profile.
`custom_rule_changed` fires once per field that differs from the table the
player started from, with the field name and its new value. Examples:
`field: "penaltyMatchMode"`, `value: "any"`; `field: "jokersEnabled"`,
`value: "false"`; `field: "penaltyPicks"`, `value: "2:4,3:3,JOKER:5"`.
`base_preset` records which preset they cloned, and `editing` separates new
tables from edits. When editing an existing custom table, `base_preset` is
`custom` and the diff covers only changes made during that edit. Free-text names
and descriptions are excluded. The Joker pick count is compared only while
Jokers are enabled, so toggling Jokers is not double-counted as a
`penaltyPicks` change.

## What is never sent as event properties

- Player names or any free text
- Custom rule names, descriptions, or share codes
- Card IDs, hands, or deck contents
- IP addresses (`ip: false` in the SDK config)
- Person profiles (`person_profiles: 'never'`; events are anonymous)
- Per-turn move/pick events; only aggregate totals in `game_finished`
- Autocaptured clicks, pageviews, heatmaps, surveys, exceptions, or web vitals

Session replay is a visual recording of the screen, so it shows the table, card
faces, bot names, and scores. Inputs, custom rule names/descriptions, and
share/import codes are masked. Treat replay as screen capture, not as a separate
analytics feed.

## Event budget

Analytics is designed to stay well inside the free tier:

- Every game sends `game_started`, `game_finished`, and a handful of screen or
  setting events.
- Per-turn moves and picks are aggregated into `game_finished`, not sent as
  individual events.
- `invalid_play` and KADI events are low-volume quality signals.
- Custom-rule saves are rare: one `custom_rules_saved` summary plus one
  `custom_rule_changed` event per changed field. Names/descriptions are never
  included.
- Replay is sampled at 10%.

At roughly 5-10 events per game, 1M events/month covers about 100K games. The
binding limit is usually replay: 5K recordings/month at 10% sampling covers about
50K sessions.

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

- `sampleRate: 0.1` — roughly one in ten sessions is recorded. Adjust
  `REPLAY_SAMPLE_RATE` in `src/analytics/client.ts` if you need more or fewer
  recordings. The free tier includes 5K recordings/month.
- `maskAllInputs: true` — every input and textarea value is masked.
- `maskTextSelector: '[data-ph-mask]'` — custom rule names/descriptions and
  other user-generated labels are masked in the DOM.
- `recordBody: false`, `recordHeaders: false` — network payloads are not
  recorded.
- No console logs are recorded.

Replay remote config comes from `/array/<token>/config`, not `/flags`. Flags stay
enabled while analytics is on because opting back in reloads them; opting out
disables remote flags before resetting so the toggle cannot fire a `/flags`
request.

## Offline behaviour

`posthog-js` retries from memory, but an offline PWA can be closed before the
network returns. Kadi keeps a capped outbox (100 events) in `localStorage`:

- Events are queued while offline or before the lazy SDK chunk loads.
- The queue flushes in order after initialization and on the browser `online`
  event.
- The oldest event is dropped when the cap is reached.
- Each queued event gets a UUID and is sent with PostHog's `uuid` option, so a
  crash between sending and clearing the queue can be deduplicated.
- Opting out clears the queue.
- Session replay cannot be captured offline; recordings resume when online.

## PostHog project setup

1. Use a **US Cloud** project and copy the project API key (`phc_...`).
2. Enable **Session Replay**.
3. Turn off autocapture, surveys, heatmaps, error tracking, and web vitals in
   the project settings. The SDK config also disables them.
4. Set a **billing limit** so the free tier cannot be exceeded unexpectedly.
5. The client samples replay at 10% (`REPLAY_SAMPLE_RATE`); adjust it if you need
   more or fewer recordings. Optionally set a minimum recording duration in the
   project (for example 10s) to skip very short sessions.
6. Add the staging and production domains to the replay authorized domains if
   that setting is present.

`posthog-js` is pinned to an exact version because opt-out cleanup uses private
SDK request and recording queues. Review those internals before upgrading.

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
- UX: invalid plays by reason, picks per game from `game_finished`, install
  funnel.
- Custom rules: `custom_rule_changed` broken down by `field` shows which rules
  players change most; filter to a field and break down by `value` to see the
  chosen values. Use `base_preset` to compare starting points.
- Replay filters: `game_finished` with `won=false`, `kadi_false`,
  `invalid_play`, or `display_mode=standalone`.
- Alert on any `bot_stall`.

Per-turn move/pick sequences are not available in events; use the sampled
replays when you need to inspect turn-by-turn behavior.

Because events are anonymous, trends/funnels/retention by distinct ID work, but
lifecycle insights and person properties do not.

## Verification

Unit tests cover config resolution (missing key, dev guard, DNT, automation),
the outbox (cap, order, failure, opt-out, UUID deduplication), event mapping,
custom-rule diffs, replay sampling, and privacy defaults. The Playwright suite
checks that the Settings toggle persists across reloads.

To verify manually:

1. Set `.env.local` with `VITE_POSTHOG_DEV=true` and run `npm run dev`.
2. Check PostHog Activity for `app_opened`, `screen_viewed`, and `game_started`.
   Confirm `move_played` and `cards_picked` never appear.
3. Play a game and confirm replay appears with inputs/custom names masked.
4. Save a custom table with a few changed rules; confirm `custom_rule_changed`
   events carry `field`/`value` but no name or description.
5. Turn analytics off and confirm no PostHog requests in DevTools.
6. Go offline, play a few moves, reconnect, and confirm queued events arrive.
