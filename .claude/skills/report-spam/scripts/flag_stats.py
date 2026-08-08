#!/usr/bin/env python3
"""Score every live trust flag on how well it actually worked.

    python3 flag_stats.py --since '2026-08-07T19:57:00'
    python3 flag_stats.py --since '2026-08-07T19:57:00' --threshold 0.9

Reads the flag set from KV, the scored reports from D1, and reports for each flag:

  precision   of the reports it fired on, how many were spam
  recall      of the spam reports, how many it fired on
  unique      spam it caught that no other flag did
  marginal    what disabling it would change, replayed over the same reports

**Marginal is the number that decides whether a flag earns its place**, and it is the one
precision and recall cannot tell you. A flag can score 56% precision and still be worth
nothing, because every report it catches is already caught by something stronger — and it
still costs you every honest report it fires on alone. That was true of the first flag this
tool was written to evaluate.

Labels come from behaviour, not from a stored identifier: an identity filing many reports
across the window is the actor. This matters because the actor rotates `client_hash`, so
anything keyed on a specific hash, or on a per-window volume threshold, under-counts them and
inflates apparent harm to real users. That mistake has been made twice by hand.

Labels are a heuristic. Treat the output as an argument, not a verdict, and sanity-check the
identity list it prints before trusting the numbers under it.
"""
import argparse
import json
import os
import subprocess
import sys
from collections import Counter, defaultdict

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from d1 import run  # noqa: E402

KV_NAMESPACE_ID = "a645de5cab1d485b95fc76dab9ceb2ea"


def load_flags(api_worker_dir: str):
    """Flag definitions live in KV, so the weights here match what actually ran."""
    # Inherit the environment: wrangler reads its OAuth token from under $HOME, so a pruned env
    # Silently produces no output rather than an error anyone can act on.
    result = subprocess.run(
        [
            f"{api_worker_dir}/node_modules/.bin/wrangler", "kv", "key", "get", "flags",
            "--namespace-id", KV_NAMESPACE_ID, "--remote",
        ],
        capture_output=True, text=True, cwd=api_worker_dir,
        env=dict(os.environ, CLOUDFLARE_ACCOUNT_ID="ae6f873c58d6fe369c686705f29417a4"),
    )
    start = result.stdout.find("[")
    if start == -1:
        raise SystemExit(
            "Could not read the flag set from KV.\n"
            f"  stdout: {result.stdout.strip()[:300]}\n  stderr: {result.stderr.strip()[:300]}"
        )
    return json.loads(result.stdout[start:])


def suppressed_counts(rows, weights, disabled, threshold, attackers):
    """Replay the station-level verdict with a given flag set. Returns (spam hidden, honest hidden)."""
    by_station = defaultdict(list)
    for r in rows:
        by_station[r["station_id"]].append(r)

    spam_hidden = honest_hidden = 0
    for reports in by_station.values():
        total = 0.0
        for r in reports:
            if r["trust"] is None:
                total += 1.0
                continue
            cost = sum(weights.get(f, 0) for f in (r["trust_flags"] or "").split(",") if f and f not in disabled)
            total += 1 / (1 + cost)
        hidden = total < threshold - 1e-9
        if hidden:
            for r in reports:
                if r["ch"] in attackers:
                    spam_hidden += 1
                else:
                    honest_hidden += 1
    return spam_hidden, honest_hidden


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--since", required=True, help="UTC timestamp, e.g. 2026-08-07T19:57:00")
    parser.add_argument("--until", default="now")
    parser.add_argument("--threshold", type=float, default=1.0, help="MIN_STATION_TRUST in force")
    parser.add_argument("--actor-min", type=int, default=6, help="reports in the window that mark an identity as one actor")
    parser.add_argument("--city", default="berlin")
    parser.add_argument(
        "--api-worker",
        default="/Users/trieloff/Developer/freifahren/FreiFahren/packages/api-worker",
        help="path to packages/api-worker, for its wrangler",
    )
    args = parser.parse_args()

    until = "unixepoch()" if args.until == "now" else f"unixepoch('{args.until}')"
    rows = run(
        f"""SELECT station_id, substr(client_hash,1,10) ch, trust, trust_flags, source
            FROM reports
            WHERE timestamp >= unixepoch('{args.since}')*1000 AND timestamp < {until}*1000""",
        city=args.city,
    )
    scored = [r for r in rows if r["trust"] is not None]
    if not scored:
        raise SystemExit("No scored reports in that window — nothing to measure.")

    per_client = Counter(r["ch"] for r in rows if r["ch"])
    attackers = {c for c, n in per_client.items() if n >= args.actor_min}

    print(f"window {args.since} -> {args.until}   threshold {args.threshold}")
    print(f"reports {len(rows)} ({len(scored)} scored)\n")
    print(f"identities filing >= {args.actor_min} reports, treated as the actor:")
    for c in sorted(attackers, key=lambda x: -per_client[x]):
        print(f"   {c}  n={per_client[c]}")
    if not attackers:
        print("   (none — with no spam in the window, precision and recall are undefined)")
        return
    spam = [r for r in scored if r["ch"] in attackers]
    honest = [r for r in scored if r["ch"] not in attackers]
    print(f"\nlabelled: {len(spam)} spam, {len(honest)} honest\n")

    flags = load_flags(args.api_worker)
    weights = {f["id"]: f["weight"] for f in flags}
    fired = {f["id"]: set() for f in flags}
    for i, r in enumerate(scored):
        for f in (r["trust_flags"] or "").split(","):
            if f in fired:
                fired[f].add(i)
    spam_idx = {i for i, r in enumerate(scored) if r["ch"] in attackers}

    base_spam, base_honest = suppressed_counts(rows, weights, set(), args.threshold, attackers)

    print(f"{'flag':<28}{'on':>5}{'prec':>7}{'recall':>8}{'uniq':>6}{'marginal (spam/honest)':>25}")
    for f in flags:
        fid = f["id"]
        hits = fired[fid]
        if not f["enabled"] and not hits:
            print(f"{fid:<28}{'-':>5}{'':>7}{'':>8}{'':>6}{'disabled, never fired':>25}")
            continue
        tp = len(hits & spam_idx)
        fp = len(hits - spam_idx)
        precision = tp / len(hits) if hits else 0.0
        recall = tp / len(spam_idx) if spam_idx else 0.0
        others = set().union(*[v for k, v in fired.items() if k != fid]) if len(fired) > 1 else set()
        unique = len((hits & spam_idx) - others)
        alt_spam, alt_honest = suppressed_counts(rows, weights, {fid}, args.threshold, attackers)
        marginal = f"{base_spam - alt_spam:+d} spam / {base_honest - alt_honest:+d} honest"
        print(f"{fid:<28}{len(hits):>5}{precision:>7.2f}{recall:>8.2f}{unique:>6}{marginal:>25}")

    print(f"\nwith every flag on: {base_spam} spam and {base_honest} honest reports suppressed")
    print("marginal = what this flag adds; '+0 spam / +N honest' means it only costs you.")


if __name__ == "__main__":
    main()
