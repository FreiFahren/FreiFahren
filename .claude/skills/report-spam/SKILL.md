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

**A weight is meaningless when a flag fires alone.** Trust is `1/(1 + cost)` and the display
threshold defaults to `1`, so any positive cost puts a single uncorroborated report under the bar —
0.4 and 6.0 have identical effect. Weights only ever separate flags in combination. This is worst
overnight, when no second report is coming to lift the first over the threshold, so a weak flag
silently censors the hours when a report is hardest to replace.

## Judging whether a flag earns its place

Once reports carry `trust_flags`, `scripts/flag_stats.py` scores every live flag against traffic
that actually happened:

```bash
python3 scripts/flag_stats.py --since '2026-08-07T19:57:00' --threshold 1.0
```

```
flag                           on   prec  recall  uniq   marginal (spam/honest)
client-burst-10m              104   1.00    0.81     0      +7 spam / +0 honest
client-station-spread-30m      88   1.00    0.69     0      +3 spam / +0 honest
bare-station-only              84   0.88    0.58     3      +5 spam / +5 honest
asn-rate-vs-hour              124   0.99    0.96     6     +17 spam / +0 honest
```

**Read the marginal column first.** Precision and recall describe a flag in isolation, and both can
look respectable on a flag that is doing nothing — because the reports it catches are already caught
by something stronger. Marginal replays the station-level verdict with that flag removed and reports
what actually changes.

`bare-station-only` above is the case worth internalising: 0.88 precision, 0.58 recall, and three
spam reports no other flag caught — all of which reads like a contributing flag. Its marginal says
**+5 spam / +5 honest**: it bought five suppressed spam reports at the price of five suppressed real
ones, one for one, while `asn-rate-vs-hour` was delivering seventeen for nothing. It was disabled on
that basis, not on the precision figure.

A flag with `+0 spam / +N honest` is pure cost and should be disabled immediately. A flag that never
fires is free, and worth keeping only if it targets an evasion you expect rather than one you have
seen.

## Marginal value misses when a flag fires

The rule above is right about cost and blind to *timing*, and disabling `bare-station-only` on it
turned out to be a mistake worth writing down.

**Most flags cannot score a client's first report.** `client-burst-10m`, `client-station-spread-30m`
and `client-teleport` all compare a report against earlier ones from the same `client_hash`, so on
report #1 there is nothing to compare and they stay silent. Only flags that read the report itself —
`bare-station-only`, `unusual-user-agent` — or its neighbourhood — `asn-rate-vs-hour` — can fire
before a client has any history.

Disabling `bare-station-only` at 03:54 on 2026-08-08 left `asn-rate-vs-hour` as the only
first-report flag. `client-teleport` did not go live until 11:53. The burst at 07:58 landed in that
gap and **leaked 8 stations, where the six other bursts leaked 0 or 1**. Marginal value had said the
flag was break-even; it did not and could not say that removing it opened an eight-hour hole in the
only layer that acts on arrival.

So read marginal value as *what this flag costs per unit of suppression*, and ask separately: **if I
disable this, what still fires on report #1?** If the answer is "nothing", the marginal number is not
the whole decision.

**Labels are behavioural, and that is a deliberate constraint.** The tool treats any identity filing
several reports in the window as the actor, because `client_hash` rotates — anything keyed on a
specific hash, or on a per-window volume threshold, under-counts a rotating actor and inflates
apparent harm to real users. That error has been made twice by hand here, both times arguing for
weakening the defence on bad numbers. Check the identity list the tool prints before trusting the
table under it.

## Arrival rhythm: too regular and too bursty are both suspicious

Uncoordinated people produce a memoryless arrival process, whose inter-arrival times are
exponentially distributed — so the coefficient of variation `CV = sd/mean` is **exactly 1**. That
gives a two-sided test with a principled centre rather than a tuned threshold:

```
CV ~ 1    what a crowd looks like
CV << 1   too regular  -> a sleep() loop, the classic beaconing signature
CV >> 1   too bursty   -> volleys from a single source
```

**The reference is not free, and it is tempting to think it is.** Superposition is exactly Poisson
only when the components are themselves Poisson; for general independent renewal processes it holds
as a limit (Palm–Khintchine), needing many sources each contributing rarely. Neither condition is
safe here. Reports are *correlated by construction* — one inspector produces several sightings from
different people within minutes — which is exactly the synchronised behaviour that breaks the
assumption, and at 10–20 reports an hour there are not many sources contributing rarely either.

So CV = 1 is a useful null to reason from, not a baseline you can assume. **Measure the honest
aggregate for the window you care about before treating any deviation as a signal**; the figure
below came out at 1.30, not 1.00, on real traffic.

Computable in one query — SQLite has no `STDDEV`, so variance comes from `E[x²] − E[x]²`:

```sql
WITH g AS (
  SELECT (timestamp - LAG(timestamp) OVER (PARTITION BY client_hash ORDER BY timestamp))/1000.0 AS gap,
         substr(client_hash,1,10) AS ch
  FROM reports WHERE client_hash IS NOT NULL AND timestamp >= unixepoch('...')*1000
)
SELECT ch, count(*) gaps, round(AVG(gap),1) mean_s,
       round(sqrt(AVG(gap*gap) - AVG(gap)*AVG(gap)) / AVG(gap), 2) cv
FROM g WHERE gap IS NOT NULL GROUP BY ch HAVING gaps >= 4 ORDER BY cv
```

**Measured on the 2026-08-07/08 incident, it did not separate.** Recorded so nobody re-derives it
and assumes it works:

```
identity      gaps  mean_s    cv
8698224762       5    25.4  0.13   <- metronomic
fb65b8ea40      52    24.2  0.59
2c5c8c0eca       6    35.2  0.85
6e80c006ce      18    38.0  1.13   <- indistinguishable from honest
fd18b7aead      53    71.2  1.83
270c546a7c      42   139.7  5.21   <- bursty

honest aggregate stream                1.30
```

Attack CVs span 0.13 to 5.21, straddling the honest value from both sides. Splitting a block into
contiguous runs (cutting at gaps over five minutes, since a loop is only punctual while it is
running) tightens it to a median of 0.67 against 1.30, but individual runs still land at 1.13 and
1.37. These are not `sleep(30)` loops: the gaps carry real jitter, from a hand-driven tool or
deliberate randomisation.

**Where it would still earn its place** is not as a detector but as a discriminator *within* the
already-flagged set. `client-burst-10m` fires on anyone filing more than four reports in ten
minutes and cannot tell a script from a person caught in a genuine inspection sweep. CV can: the
person is irregular, the script is not.

That case cannot be validated yet — **no honest client in the dataset has filed four reports**, so
the false positive it would prevent has never been observed. Shipping it now would be tuning
against a projection. Revisit if `client-burst-10m` ever starts catching real people, and validate
with `flag_stats.py` against that traffic rather than against this incident.

## Turning a dial

Both live controls take effect immediately, with no deploy, because both are Worker secrets:

```bash
wrangler secret put REPORTING_ENABLED     # true / false — the killswitch
wrangler secret put MIN_STATION_TRUST     # how much trust a station needs before it shows
```

Prefer measuring a threshold change before making it. Replaying the night of 2026-08-07 showed that
disabling one weak flag took honest suppression from 5 to 0 on its own, while lowering the threshold
cost four more spam reports and changed the honest count not at all.

## Reporting what you found

Give the shape, not just the count: reports, distinct clients, distinct ASNs, and reports per
station. "25 reports from 5 clients across 5 networks, one report each" and "20 reports from one
client at 30-second intervals" are the same volume and opposite conclusions, and the second number
is the one that decides anything.

State plainly what is confirmed, what is consistent-with, and what cannot be known from the data
you have.
