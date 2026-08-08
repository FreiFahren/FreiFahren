#!/usr/bin/env python3
"""Run a read-only query against a production FreiFahren D1 database.

    python3 d1.py "SELECT count(*) FROM reports"
    python3 d1.py "SELECT * FROM reports WHERE report_id = ?1" --params 215569
    python3 d1.py "SELECT ..." --city leipzig --json

Uses the OAuth token wrangler already holds, so there is nothing to configure. The token
expires roughly hourly; this refreshes it by shelling out to `wrangler whoami` and retries
once, which is the failure everyone hits on their second hour of investigating.

Deliberately refuses anything that is not a SELECT. Investigation is a read activity, and a
stray UPDATE against production reports while chasing a spammer is not recoverable.
"""
import argparse
import json
import re
import subprocess
import sys
import urllib.error
import urllib.request

ACCOUNT_ID = "ae6f873c58d6fe369c686705f29417a4"
WRANGLER_CONFIG = "/Users/trieloff/Library/Preferences/.wrangler/config/default.toml"

DATABASES = {
    "berlin": "f8e11f14-15a5-42a8-8eba-5ab513175890",
    "leipzig": "e590b909-ce9e-4b32-8761-8e86f2e036d3",
}


# A CTE is read-only but does not start with SELECT, and `WITH ... AS (...) DELETE FROM ...` is
# valid SQLite — so the opening keyword alone decides neither way. Check both ends.
MUTATING = re.compile(r"\b(insert|update|delete|drop|alter|create|replace|attach|pragma|vacuum)\b", re.I)


def is_read_only(statement: str) -> bool:
    if not statement.lower().startswith(("select", "with", "explain")):
        return False
    return MUTATING.search(statement) is None


def read_token() -> str:
    with open(WRANGLER_CONFIG) as handle:
        for line in handle:
            if line.startswith("oauth_token"):
                return line.split("= ", 1)[1].strip().strip('"')
    raise SystemExit("No oauth_token in wrangler config — run `wrangler login`.")


def refresh_token() -> str:
    """`wrangler whoami` renews the OAuth token as a side effect."""
    subprocess.run(["npx", "wrangler", "whoami"], capture_output=True, check=False)
    return read_token()


def query(sql: str, params=None, city="berlin", token=None):
    token = token or read_token()
    body = {"sql": sql}
    if params:
        body["params"] = params
    request = urllib.request.Request(
        f"https://api.cloudflare.com/client/v4/accounts/{ACCOUNT_ID}/d1/database/{DATABASES[city]}/query",
        data=json.dumps(body).encode(),
        headers={"Authorization": f"Bearer {token}", "Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(request) as response:
            payload = json.loads(response.read().decode())
    except urllib.error.HTTPError as error:
        # An expired OAuth token comes back as a 401 status, not as a 200 carrying an error
        # body — so this has to be caught here rather than checked below.
        if error.code in (401, 403):
            return None  # caller retries once with a refreshed token
        raise SystemExit(f"Cloudflare API {error.code}: {error.read().decode()[:200]}")

    if not payload.get("success"):
        errors = payload.get("errors") or []
        if any(e.get("code") == 10000 for e in errors):
            return None
        raise SystemExit(f"D1 error: {errors}")
    return payload["result"][0]["results"]


def run(sql, params=None, city="berlin"):
    rows = query(sql, params, city)
    if rows is None:
        rows = query(sql, params, city, token=refresh_token())
    if rows is None:
        raise SystemExit("Authentication failed even after refresh — check `wrangler whoami`.")
    return rows


def as_table(rows) -> str:
    if not rows:
        return "(no rows)"
    columns = list(rows[0].keys())
    widths = {c: max(len(c), *(len(str(r.get(c))) for r in rows)) for c in columns}
    out = ["  ".join(c.ljust(widths[c]) for c in columns)]
    out.append("  ".join("-" * widths[c] for c in columns))
    for row in rows:
        out.append("  ".join(str(row.get(c)).ljust(widths[c]) for c in columns))
    return "\n".join(out)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("sql")
    parser.add_argument("--city", choices=sorted(DATABASES), default="berlin")
    parser.add_argument("--params", nargs="*", default=None)
    parser.add_argument("--json", action="store_true", help="emit JSON instead of a table")
    args = parser.parse_args()

    statement = args.sql.strip()
    if not is_read_only(statement):
        raise SystemExit("Refusing: this tool is read-only (SELECT / WITH / EXPLAIN QUERY PLAN).")

    rows = run(statement, args.params, args.city)
    print(json.dumps(rows, indent=2) if args.json else as_table(rows))


if __name__ == "__main__":
    main()
