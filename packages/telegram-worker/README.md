# telegram-worker

TypeScript Cloudflare Worker for the FreiFahren Telegram bot. Telegram POSTs
inspector-sighting messages to `/telegram/webhook`; the worker extracts a station/line/direction
with Mistral and submits a report to the backend. App reports POSTed to `/report` are forwarded
back into the Telegram chat. All Berlin/German specifics live in `src/config.ts`.

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

Reads `MISTRAL_API_KEY` / `BACKEND_URL` / `MISTRAL_MODEL` from the env or `.dev.vars`.

## Deploy

Set secrets (`MISTRAL_API_KEY`, `TELEGRAM_BOT_TOKEN`, `REPORT_PASSWORD`, `TELEGRAM_WEBHOOK_SECRET`)
with `wrangler secret put <NAME>`, fill `TELEGRAM_REPORT_CHAT_ID` in `wrangler.jsonc`, then
`bun run deploy`. Register the webhook:

```sh
curl "https://api.telegram.org/bot<TOKEN>/setWebhook" \
  -d "url=https://<worker-host>/telegram/webhook" \
  -d "secret_token=<TELEGRAM_WEBHOOK_SECRET>"
```
