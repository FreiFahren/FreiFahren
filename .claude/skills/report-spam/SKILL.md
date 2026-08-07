---
name: report-spam
description: Investigate, confirm and act on fake inspector reports in FreiFahren — querying production D1 for report traffic, reading Turnstile verification logs in Sentry, telling coordinated submission apart from a busy evening, and adding or validating trust flags. Use this whenever someone asks about report spam, false or fake reports, a traffic spike or surge, whether reporting should be opened or closed, why the map looks wrong, who is behind a burst of reports, or wants to add, weight or check a trust flag — and also when they simply ask for a "data check" on reports, since that is usually this question in disguise.
---

# Investigating report spam

FreiFahren's map is only worth what its reports are worth, so someone submitting fake sightings
degrades the product directly. This skill is the accumulated method for finding them, being sure,
and doing something about it — including the mistakes that produced plausible wrong answers.

## Getting at the data

Use `scripts/d1.py` rather than wrangler. The Homebrew wrangler is too old to parse this repo's
config (it rejects `observability.traces`), `node_modules` is often absent so `npx wrangler` falls
back to it, and the OAuth token expires roughly hourly. The script goes straight to the D1 REST
API, refreshes the token on expiry, and refuses anything that is not a `SELECT`.

```bash
python3 scripts/d1.py "SELECT count(*) FROM reports"
python3 scripts/d1.py "SELECT ..." --city leipzig --json
```

For Sentry, `~/.sentryclirc` is configured against org `freifahren-web` (projects `api-worker`,
`telegram-worker`, `web-app`). One trap: **sentry-cli refuses to combine a `--url` flag with a
token from the config file**, so call it with no `--url` and let the config supply both.

## What a report carries

```
report_id  station_id  line_id  direction_id  timestamp  source
asn  as_organization  ua_family  client_hash        -- attribution, from 2026-08-07 17:59
trust  trust_flags                                  -- scoring, assigned after the write
```

Four things about these columns cause wrong answers if you don't know them:

**Group by `asn`, never by `as_organization`.** One network reports under several names — AS3209
appears as both "Vodafone GmbH" and "Kabel Deutschland Vertrieb und Service GmbH", AS3320 as both
"Deutsche Telekom AG" and "Telekom Deutschland GmbH". Grouping by name splits one carrier into
several and understates each. This has already produced a wrong answer once, and it looked fine.

**`trust IS NULL` means not yet scored, not untrusted.** Scoring runs after the write. Treating
null as untrusted would empty the map during any scorer outage.

**Telegram reports carry no attribution at all, by design.** They arrive server-to-server, so the
network and user agent describe `telegram-worker` rather than a reporter. Filter
`source <> 'telegram'` before computing any rate over attribution, or every figure is diluted.

**Nothing before 2026-08-07 17:59 has attribution.** The big surge of 08-06 is confirmed spam and
permanently unattributable. If someone asks you to select historical spam by ASN, that is why you
cannot.

## Deciding whether traffic is spam

The instinct is to look at volume. Volume alone is a bad test — real evenings are busy, and the
question is always *shape*.

**Compare against size-matched windows, not against a long baseline.** Reports-per-station and
rank correlation both drift with sample size, so a 90-minute window compared against a nine-day
baseline will look anomalous whatever it contains. Chunk a known-clean period into windows of the
same *n* as the suspect window and see where the suspect falls in that spread. This is the single
most important step; skipping it manufactures findings.

The signature, confirmed on two independent bursts (one labelled by the team as spam):

| measure | organic | spam |
|---|---|---|
| inter-arrival, median | ~230s | **29–30s**, tight |
| reports per distinct station | 1.2–1.6 | **1.00** |
| missing `direction_id` | ~54% | 74–78% |
| missing `line_id` | 9–29% | 31–53% |

**Reports-per-station of exactly 1.00 is the strongest single tell.** A script walking a station
list never revisits; people cluster on the stations they actually use. The metronomic cadence is
next: a median of 29s with little spread is a `sleep`, not a person.

Beware the trap in the fourth row: *plausibility* measures like "unusual station for this hour"
are excluded on purpose. The first report of a genuinely new hotspot is by definition unusual, and
it is the most valuable report the system receives. Judge how the submission arrived, never
whether the sighting seems likely.

## Confirming before acting

Two checks that have each changed a conclusion:

**Rule out a client-side explanation.** Field-completeness shifts can come from a deploy, not an
attacker. Check whether the report form changed in the window before concluding anything — the
pickers being hidden or a flag flipped produces exactly the "more missing fields" signature.

**Ask the team before attributing.** A concentrated burst from one ISP can be an attacker or a
teammate load-testing. One ISP producing half of all submissions looked damning and *was* spam —
but that was confirmed by asking, not by the data. Say "consistent with" until someone confirms.

Also worth knowing: **Turnstile does not stop this actor.** They solve the challenge inline —
tokens minted on the real widget and redeemed under a second old — so "it passed Turnstile" is not
evidence of legitimacy. It has been re-confirmed three times.

## Reading Turnstile logs

Structured fields in Sentry Logs are **not queryable as attributes**. The logger passes objects
through `console.*`, and Sentry's console integration flattens them into the message string, so
`outcome:refused` returns zero results and looks like nothing is being refused. Scrape and regex
instead:

```
/api/0/organizations/freifahren-web/events/?dataset=ourlogs
  &field=timestamp&field=message&statsPeriod=24h
  &project=4511638467051600&query="Turnstile verification"
```

Then pull `outcome`, `platform`, `asn`, `asOrganization` out of the message text. Check timestamps
before interpreting refusals: nine refusals spread over an evening are stale clients, and nine in
a 21-second burst are a script. Reading the count without the spacing gets this backwards.

## Acting on it

**Closing and opening reporting** is one switch, `REPORTING_ENABLED` on api-worker. It takes
effect in 20–30 seconds with no redeploy, and the client follows automatically because it probes
`GET /v0/config`. Verify with a tokenless POST, which is rejected either way and so creates
nothing:

```bash
curl -s https://api.freifahren.org/v0/config
curl -s -X POST https://api.freifahren.org/v0/reports \
  -H 'Content-Type: application/json' -H 'ff-platform: web' --data '{}'
```

`REPORTING_DISABLED` means closed; `TURNSTILE_FAILED` means open and enforcing. Send
`ff-platform`, or a WAF rule returns an HTML 403 that is easy to misread as an API response.

**Adding a trust flag** is a KV write, not a deploy — that is the whole point, since patterns are
found while they are running:

```bash
python3 scripts/d1.py "SELECT ..."          # find the pattern
python3 scripts/validate_flag.py --sql "..." --spam "client_hash LIKE 'abc%'"
wrangler kv key get flags --namespace-id a645de5cab1d485b95fc76dab9ceb2ea --remote
# edit, then put it back
```

Validate before shipping. `validate_flag.py` reports the hit rate on labelled spam, the hit rate
on honest traffic, and the query plan. All three matter: a flag runs on every insert, and `SCAN
reports` on a 100k-row table lands on the worker's largest existing performance problem.

Flags are weighted, `trust = 1 / (1 + Σ weights)`. Weight by how rare the flag is in *honest*
traffic, computed over a frozen clean corpus rather than the live stream — computed live, a large
attack makes its own patterns common and collapses their weight exactly when they are needed.
Per-ASN flags need lower weights than per-client ones because they catch bystanders: AS3320 is
Telekom, and an honest report arriving mid-burst on the same carrier will trip an ASN rate flag.

## Reporting what you found

Give the shape, not just the count: reports, distinct clients, distinct ASNs, and reports per
station. "25 reports from 5 clients across 5 networks, one report each" and "20 reports from one
client at 30-second intervals" are the same volume and opposite conclusions, and the second number
is the one that decides anything.

State plainly what is confirmed, what is consistent-with, and what cannot be known from the data
you have.
