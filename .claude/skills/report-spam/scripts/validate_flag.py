#!/usr/bin/env python3
"""Check a candidate trust flag against labelled traffic before it goes live.

    python3 validate_flag.py --sql "SELECT ... WHERE report_id = ?1" \
        --spam "client_hash LIKE 'f3617a0a0a%'"

Reports three things, all of which have caught a bad flag at least once:

  hit rate on spam    — does it fire on the traffic you are trying to catch?
  hit rate on honest  — what does it cost everyone else? anything above a few percent
                        means real reports will need corroboration they should not need
  query plan          — a flag runs on every insert. `SCAN reports` here means you are
                        about to add a full table scan to the write path of a table with
                        100k+ rows, on a worker whose largest Sentry issue is slow queries

`--spam` and `--ham` are SQL predicates over `reports`, so you can label however you like:
a client_hash, an asn, a time window. `--ham` defaults to attributed traffic that is not
spam, which is the comparison that matters — unattributed historical rows cannot exercise
a flag that reads asn or client_hash, and including them silently deflates the hit rate.
"""
import argparse
import sys

sys.path.insert(0, __file__.rsplit("/", 1)[0])
from d1 import run  # noqa: E402


def ids_for(predicate: str, city: str, limit: int):
    rows = run(f"SELECT report_id FROM reports WHERE {predicate} ORDER BY report_id DESC LIMIT {limit}", city=city)
    return [r["report_id"] for r in rows]


def fires_on(sql: str, report_ids, city: str):
    hits = 0
    for report_id in report_ids:
        rows = run(sql, [report_id], city)
        if rows:
            value = list(rows[0].values())[0]
            if value not in (0, None, False, ""):
                hits += 1
    return hits


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--sql", required=True, help="the flag predicate; ?1 is bound to report_id")
    parser.add_argument("--spam", required=True, help="SQL predicate selecting known-spam rows")
    parser.add_argument(
        "--ham",
        default="client_hash IS NOT NULL",
        help="SQL predicate selecting known-good rows (default: all attributed rows, minus spam)",
    )
    parser.add_argument("--city", default="berlin")
    parser.add_argument("--limit", type=int, default=200)
    args = parser.parse_args()

    spam = ids_for(args.spam, args.city, args.limit)
    ham = [i for i in ids_for(args.ham, args.city, args.limit) if i not in set(spam)]
    if not spam:
        raise SystemExit("No rows matched --spam; nothing to validate against.")

    spam_hits = fires_on(args.sql, spam, args.city)
    ham_hits = fires_on(args.sql, ham, args.city) if ham else 0

    spam_rate = spam_hits / len(spam) * 100
    ham_rate = ham_hits / len(ham) * 100 if ham else 0.0

    print(f"  spam   {spam_hits}/{len(spam)}  ({spam_rate:.0f}%)")
    print(f"  honest {ham_hits}/{len(ham)}  ({ham_rate:.0f}%)")
    print()
    if spam_rate < 40:
        print("  -> weak: misses most of the traffic it targets")
    elif ham_rate > 20:
        print("  -> costly: fires on honest reports often enough to make them need corroboration")
    else:
        print("  -> discriminates")

    print("\n  query plan:")
    for row in run("EXPLAIN QUERY PLAN " + args.sql, [spam[0]], args.city):
        detail = row.get("detail", "")
        marker = "  <-- FULL SCAN, do not ship" if detail.startswith("SCAN") and "USING" not in detail else ""
        print(f"    {detail}{marker}")


if __name__ == "__main__":
    main()
