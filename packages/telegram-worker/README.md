# telegram-worker

TypeScript Cloudflare Worker that replaces the Python `packages/telegram_bot`. It ingests
Telegram inspector-sighting messages, extracts a station/line/direction with Mistral, and
submits a report to the backend — and forwards app reports back into the Telegram chat.

It is a behavior-for-behavior port of the Python package; the extraction logic (spam filter,
line detection, name normalization, two-tier fuzzy station matching) is reproduced verbatim.

## Architecture

```
Telegram ──POST /telegram/webhook──▶ verify secret · filter (chat/text/command) · waitUntil(pipeline) → 200
pipeline ──▶ isSpam → getTransitIndex (fetch) → detectLine → Mistral → resolve → POST /v0/reports
POST /report ──▶ verify REPORT_PASSWORD → validate → Telegram sendMessage (deep link)
```

- **Background processing, no retry.** The webhook returns `200` instantly and runs the
  pipeline in the background via `ctx.waitUntil` — so Telegram never re-delivers (no
  duplicates). There's no queue: a failed run (e.g. a Mistral timeout) is dropped. The Mistral
  call has a 20s timeout so a hung request can't linger. Error tracking is a TODO
  ([FreiFahren#689](https://github.com/FreiFahren/FreiFahren/issues/689)).
- **Transit data fetched per message.** `getTransitIndex` fetches `/v0/transit/{stations,lines}`
  and builds the in-memory index on each run. There's no KV/cron — caching is meant to be done
  at the edge with a Cloudflare cache rule on `/v0/transit/*` (see Caching below).
- **City-agnostic.** All Berlin/German specifics live in `src/config.ts` only.

## Layout

| File | Role |
| --- | --- |
| `src/index.ts` | Router: `fetch` (webhook + `/report`) |
| `src/webhook.ts` | Verify secret, filter (`acceptUpdate`), dispatch via `waitUntil` |
| `src/pipeline.ts` | extract → resolve → submit (was `handle_text`) |
| `src/extractor.ts` | line detection, prompt, Mistral call, normalize, fuzzy pick, resolve |
| `src/transit.ts` | `getTransitIndex` (fetch backend) + `buildIndex` |
| `src/reporting.ts` | `POST /v0/reports` |
| `src/forwarding.ts` | `POST /report` handler |
| `src/spam.ts` | `isSpam` |
| `src/observability.ts` | `reportError` — the single error-reporting seam |
| `src/config.ts` | **All** city/language specifics + env parsing |
| `src/types.ts` | zod schemas + bindings |

## Develop

```sh
bun install
cp .dev.vars.example .dev.vars   # fill in secrets
bun run typecheck
bun run test                     # vitest + @cloudflare/vitest-pool-workers
bun run dev
```

## Bindings / config (`wrangler.jsonc`)

- **Vars**: `BACKEND_URL`, `PUBLIC_APP_URL`, `CITY_NAME`, `MISTRAL_MODEL`, `TELEGRAM_REPORT_CHAT_ID`.
- **Secrets** (`wrangler secret put`): `MISTRAL_API_KEY`, `TELEGRAM_BOT_TOKEN`, `REPORT_PASSWORD`,
  `TELEGRAM_WEBHOOK_SECRET`.

## Monitoring (TODO)

There's no retry/DLQ, so a failed pipeline run drops the message. Error tracking + alerting on
error rates is not wired yet — tracked in
[FreiFahren#689](https://github.com/FreiFahren/FreiFahren/issues/689). `reportError`
(`src/observability.ts`) is the single seam to implement it: today it only logs to the live
tail; point it at the chosen sink there.

## Caching

`getTransitIndex` fetches the transit endpoints on every message — there's no KV cache or
cron. Cache it at the edge with a **Cloudflare cache rule** on `api.freifahren.org` scoped to
`/v0/transit/*` (set an Edge TTL, e.g. 1h). Caveat: those endpoints echo the request `Origin`
into `Access-Control-Allow-Origin` and send `Vary: Origin`, which Cloudflare's standard cache
ignores — so either add `Origin` to the cache key or serve `Access-Control-Allow-Origin: *`
for `/v0/transit/*` first, otherwise a cached response can break CORS for browser consumers.
The Worker's own fetch sends no `Origin`, so it isn't affected by that itself.

## Deploy & migrate off the Python bot

1. Create the queues, fill `wrangler.jsonc` (`TELEGRAM_REPORT_CHAT_ID`), set secrets, then `bun run deploy`.
2. Register the webhook (this also primes the secret the worker checks):
   ```sh
   curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
     -d "url=https://<worker-host>/telegram/webhook" \
     -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
   ```
3. Repoint the Hono backend's report-forwarding target to `https://<worker-host>/report`
   (keeps the `X-Password` header).
4. **Stop the Python long-poller** — Telegram allows webhook *or* polling, not both.
5. Verify: a real inspector message produces a report; a forwarded app report appears in chat.
6. Remove `packages/telegram_bot` once parity is confirmed.

## Behavior parity with the Python bot

- Only processes messages from `TELEGRAM_REPORT_CHAT_ID`; ignores everything else.
- Reads text **or** photo caption; ignores `/commands`.
- Spam filter: short/long/question-mark/URL/emoji rules (`test/spam.test.ts`).
- Line detection incl. circular-line alias (`Ring`/`Ringbahn`/`S-Ring`).
- `normalizeName`: prefix strip + umlaut fold + abbreviation expansion + NFKD.
- `pickStation`: two-tier scoring + on-line preference (off-line only if gap > 0.1) +
  generic-word rejection (`test/resolution.test.ts`).
- Report payload `{ stationId, lineId?, directionId?, source: "telegram" }`.
- `/report` forwarding: auth, message text, deep link with utm params (`test/forwarding.test.ts`).
