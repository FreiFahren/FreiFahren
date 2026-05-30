# telegram_bot

## Run

```bash
uv sync
cp .env.example .env  # fill in the values
uv run python -m telegram_bot.main
```

See `.env.example` for the required environment variables.

## Evals

End-to-end accuracy harness for the extractor. Runs the real `extract()` (regex line detection → Mistral LLM → fuzzy station resolution against the live backend) against a hand-labeled dataset and emits a markdown report.

### Run

From this directory:

```bash
uv run python evals/run.py                    # full set (~10 min at parallel=16, ~1k msgs)
uv run python evals/run.py --smoke            # 200 random rows (fast iteration)
uv run python evals/run.py --smoke --n 50     # custom sample size
uv run python evals/run.py --parallel 16      # bump concurrency for speed
uv run python evals/run.py --smoke --parallel 16
```

Requires the same env as the bot (`BACKEND_URL`, `MISTRAL_API_KEY`, optional `MISTRAL_MODEL`). The backend must be reachable so transit data can be loaded.

### Latest results

Up-to-date headline numbers and per-field metrics live in `evals/eval_report.md` (regenerated on every run). Per-row predictions for drill-down are in `evals/eval_results.json`.

The dataset (`evals/messages.json`) is **not** committed for compliance reasons.
