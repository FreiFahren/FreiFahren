# telegram-worker

TypeScript Cloudflare Worker for the FreiFahren Telegram bot. Telegram POSTs
inspector-sighting messages to `/telegram/webhook`; the worker extracts a station/line/direction
with Mistral and submits a report to the backend. App reports POSTed to `/report?city=<slug>` are
forwarded back into that city's Telegram chat. The single deployed Worker routes each incoming
message through the allowlisted `TELEGRAM_CHAT_CITIES` map in `wrangler.jsonc`.

## Develop

```sh
bun install
cp .dev.vars.example .dev.vars   # fill in secrets
bun run test                     # vitest — no live services needed
bun run dev                      # http://localhost:8787
```

## Evals

`evals/run.ts` runs the extraction pipeline over a labeled dataset and reports per-field
accuracy / precision / recall / F1. Drop the dataset in at `evals/messages.json` (gitignored;
rows of `{ id, text, naive_labels: { stationId, directionId, lineName } }`), then:

```sh
bun run eval                       # full dataset
bun run eval --smoke --n 200       # seeded random sample
```

Reads `MISTRAL_API_KEY` / `BACKEND_URL` / `MISTRAL_MODEL` from the env or `.dev.vars`. The
shared dataset contains cases for every supported city.

## Deploy

Set secrets (`MISTRAL_API_KEY`, `TELEGRAM_BOT_TOKEN`, `REPORT_PASSWORD`, `TELEGRAM_WEBHOOK_SECRET`)
with `wrangler secret put <NAME>`, configure every allowed group in `TELEGRAM_CHAT_CITIES`, then
`bun run deploy`. Add the existing bot to each configured group and register its webhook once:

```sh
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<worker-host>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
