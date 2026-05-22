from __future__ import annotations

import argparse
import asyncio
import json
import random
import time
from dataclasses import dataclass
from pathlib import Path

from dotenv import load_dotenv
from mistralai.client import Mistral

from telegram_bot import config
from telegram_bot.extractor import (
    ExtractionResult,
    StationIndex,
    build_line_pattern,
    build_system_prompt,
    extract,
)
from telegram_bot.transit import TransitData, load_transit_data


EVAL_DIR = Path(__file__).resolve().parent
DATA_PATH = EVAL_DIR / 'messages.json'
REPORT_PATH = EVAL_DIR / 'eval_report.md'
RESULTS_PATH = EVAL_DIR / 'eval_results.json'


@dataclass
class RowOutcome:
    """Per-row evaluation result."""

    row_id: str
    text: str
    expected: dict[str, str | None]
    actual: dict[str, str | None]
    correct_station: bool
    correct_direction: bool
    correct_line: bool
    error: str | None = None  # populated when extract() returned None

    @property
    def fully_correct(self) -> bool:
        return self.correct_station and self.correct_direction and self.correct_line


def expected_line_tokens(line_label: str | None) -> set[str] | None:
    """Tokenize the label's lineName so compound labels like 'U1 U3' or 'S41 42' both match.

    Returns None when the label has no line (so the bot must also return None).
    """
    if line_label is None:
        return None
    return {tok for tok in line_label.split() if tok}


def line_correct(expected: str | None, actual: str | None) -> bool:
    """Bot is correct if it picks ANY token from a compound label, or both are null."""
    tokens = expected_line_tokens(expected)
    if tokens is None:
        return actual is None
    return actual in tokens


async def run_one(
    *,
    row: dict,
    transit: TransitData,
    client: Mistral,
    model: str,
    line_pattern,
    station_index: StationIndex,
    system_prompt: str,
    semaphore: asyncio.Semaphore,
) -> RowOutcome:
    async with semaphore:
        try:
            result: ExtractionResult | None = await extract(
                message=row['text'],
                transit=transit,
                client=client,
                model=model,
                line_pattern=line_pattern,
                station_index=station_index,
                system_prompt=system_prompt,
            )
        except Exception as exc:  # network blip, parsing, etc.
            result = None
            error = f'{type(exc).__name__}: {exc}'
        else:
            error = None

    expected = row['naive_labels']
    if result is None:
        actual: dict[str, str | None] = {'stationId': None, 'directionId': None, 'lineName': None}
    else:
        actual = {
            'stationId': result.station_id,
            'directionId': result.direction_id,
            'lineName': result.line_name,
        }

    return RowOutcome(
        row_id=row['id'],
        text=row['text'],
        expected={
            'stationId': expected.get('stationId'),
            'directionId': expected.get('directionId'),
            'lineName': expected.get('lineName'),
        },
        actual=actual,
        correct_station=actual['stationId'] == expected.get('stationId'),
        correct_direction=actual['directionId'] == expected.get('directionId'),
        correct_line=line_correct(expected.get('lineName'), actual['lineName']),
        error=error,
    )


def field_metrics(outcomes: list[RowOutcome], field: str, correctness_attr: str) -> dict[str, float | int]:
    """Compute accuracy + precision/recall/F1 treating null as 'negative'."""
    tp = fp = fn = tn = 0
    for o in outcomes:
        exp = o.expected[field]
        act = o.actual[field]
        if exp is not None and act is not None:
            if getattr(o, correctness_attr):
                tp += 1
            else:
                fp += 1  # bot picked something, but wrong one (also counts as FN)
                fn += 1
        elif exp is None and act is not None:
            fp += 1
        elif exp is not None and act is None:
            fn += 1
        else:
            tn += 1
    total = len(outcomes)
    correct = sum(1 for o in outcomes if getattr(o, correctness_attr))
    precision = tp / (tp + fp) if (tp + fp) else 0.0
    recall = tp / (tp + fn) if (tp + fn) else 0.0
    f1 = (2 * precision * recall / (precision + recall)) if (precision + recall) else 0.0
    return {
        'accuracy': correct / total if total else 0.0,
        'correct': correct,
        'total': total,
        'tp': tp,
        'fp': fp,
        'fn': fn,
        'tn': tn,
        'precision': precision,
        'recall': recall,
        'f1': f1,
    }


def build_report(
    *,
    outcomes: list[RowOutcome],
    duration_s: float,
    smoke: bool,
    sample_size: int,
    dataset_size: int,
    parallel: int,
    model: str,
) -> str:
    n = len(outcomes)
    station = field_metrics(outcomes, 'stationId', 'correct_station')
    direction = field_metrics(outcomes, 'directionId', 'correct_direction')
    line = field_metrics(outcomes, 'lineName', 'correct_line')
    fully = sum(1 for o in outcomes if o.fully_correct)
    errors = sum(1 for o in outcomes if o.error is not None)

    def pct(x: float) -> str:
        return f'{x * 100:.1f}%'

    def field_row(name: str, m: dict) -> str:
        return (
            f'| {name} | {pct(m["accuracy"])} | {m["correct"]}/{m["total"]} | '
            f'{pct(m["precision"])} | {pct(m["recall"])} | {pct(m["f1"])} | '
            f'{m["tp"]} | {m["fp"]} | {m["fn"]} | {m["tn"]} |'
        )

    lines: list[str] = []
    lines.append('# Telegram bot extractor — eval report')
    lines.append('')
    mode = 'SMOKE' if smoke else 'FULL'
    lines.append(f'**Mode:** {mode} ({n} rows of {dataset_size})  ')
    lines.append(f'**Model:** `{model}`  ')
    lines.append(f'**Parallelism:** {parallel}  ')
    lines.append(f'**Wall time:** {duration_s:.1f}s ({n / duration_s:.1f} msg/s)  ')
    lines.append(f'**LLM/network errors:** {errors}')
    lines.append('')
    lines.append('## Headline')
    lines.append('')
    lines.append(f'- **Fully correct rows** (all three fields match): {fully}/{n} = **{pct(fully / n)}**')
    lines.append(f'- Station accuracy: **{pct(station["accuracy"])}**')
    lines.append(f'- Direction accuracy: **{pct(direction["accuracy"])}**')
    lines.append(f'- Line accuracy: **{pct(line["accuracy"])}**')
    lines.append('')
    lines.append('## Per-field metrics')
    lines.append('')
    lines.append('Null is treated as a negative prediction. *Precision* = "when the bot says X, '
                 'how often is X right?". *Recall* = "when the label has a value, how often does '
                 'the bot extract it correctly?".')
    lines.append('')
    lines.append('| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |')
    lines.append('|---|---|---|---|---|---|---|---|---|---|')
    lines.append(field_row('stationId', station))
    lines.append(field_row('directionId', direction))
    lines.append(field_row('lineName', line))
    lines.append('')
    lines.append('See `eval_results.json` for the full per-row breakdown.')
    return '\n'.join(lines) + '\n'


async def main() -> None:
    parser = argparse.ArgumentParser(description='Run the telegram_bot extractor against messages.json')
    parser.add_argument('--smoke', action='store_true', help='Sample N random rows instead of running the full set')
    parser.add_argument('--n', type=int, default=200, help='Smoke-test sample size (default 200)')
    parser.add_argument('--parallel', type=int, default=1, help='Max concurrent LLM calls (default 1)')
    parser.add_argument('--seed', type=int, default=42, help='Sampling seed for --smoke (default 42)')
    parser.add_argument('--data', type=Path, default=DATA_PATH, help='Path to messages.json')
    parser.add_argument('--report', type=Path, default=REPORT_PATH, help='Markdown report output path')
    parser.add_argument('--results', type=Path, default=RESULTS_PATH, help='Per-row JSON output path')
    args = parser.parse_args()

    load_dotenv()
    data = json.loads(args.data.read_text())
    dataset_size = len(data)
    if args.smoke:
        random.seed(args.seed)
        data = random.sample(data, min(args.n, len(data)))

    transit = await load_transit_data(config.BACKEND_URL)
    station_index = StationIndex.build(transit)
    line_pattern = build_line_pattern(transit.line_names)
    system_prompt = build_system_prompt(transit)
    client = Mistral(api_key=config.MISTRAL_API_KEY)
    semaphore = asyncio.Semaphore(max(1, args.parallel))

    print(f'running {len(data)} rows with parallel={args.parallel} model={config.MISTRAL_MODEL}...')
    start = time.time()
    outcomes: list[RowOutcome] = await asyncio.gather(
        *(
            run_one(
                row=row,
                transit=transit,
                client=client,
                model=config.MISTRAL_MODEL,
                line_pattern=line_pattern,
                station_index=station_index,
                system_prompt=system_prompt,
                semaphore=semaphore,
            )
            for row in data
        )
    )
    duration = time.time() - start

    args.report.write_text(
        build_report(
            outcomes=outcomes,
            duration_s=duration,
            smoke=args.smoke,
            sample_size=len(data),
            dataset_size=dataset_size,
            parallel=args.parallel,
            model=config.MISTRAL_MODEL,
        )
    )
    args.results.write_text(
        json.dumps(
            [
                {
                    'id': o.row_id,
                    'text': o.text,
                    'expected': o.expected,
                    'actual': o.actual,
                    'correct': {
                        'stationId': o.correct_station,
                        'directionId': o.correct_direction,
                        'lineName': o.correct_line,
                        'all': o.fully_correct,
                    },
                    'error': o.error,
                }
                for o in outcomes
            ],
            ensure_ascii=False,
            indent=2,
        )
    )
    print(f'done in {duration:.1f}s — report at {args.report}, per-row at {args.results}')


if __name__ == '__main__':
    asyncio.run(main())
