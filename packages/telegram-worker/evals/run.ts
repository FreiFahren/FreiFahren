import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { getTransitIndex } from '../src/transit'
import {
    buildLinePattern,
    buildSystemPrompt,
    detectLineName,
    extractWithMistral,
    resolveExtraction,
    type ExtractionResult,
} from '../src/extractor'
import type { TransitIndex } from '../src/types'

const EVAL_DIR = dirname(fileURLToPath(import.meta.url))
const DATA_PATH = join(EVAL_DIR, 'messages.json')
const REPORT_PATH = join(EVAL_DIR, 'eval_report.md')
const RESULTS_PATH = join(EVAL_DIR, 'eval_results.json')

type Labels = { stationId: string | null; directionId: string | null; lineName: string | null }
interface Row {
    id: string
    text: string
    naive_labels: Labels
}

interface RowOutcome {
    rowId: string
    text: string
    expected: Labels
    actual: Labels
    correctStation: boolean
    correctDirection: boolean
    correctLine: boolean
    error: string | null
}

const fullyCorrect = (o: RowOutcome): boolean => o.correctStation && o.correctDirection && o.correctLine

// ---------------------------------------------------------------------------
// Line scoring (port of expected_line_tokens / line_correct)
// ---------------------------------------------------------------------------

const LINE_TOKEN_RE = /^([A-Za-z]+)(\d+)$/

/**
 * Tokenize the label's lineName so compound labels like "U1 U3" or "S41 42" both match. A
 * bare-digit token (the "42" in "S41 42") inherits the letter prefix from the most recent
 * letter-bearing token. Returns null when the label has no line (so the bot must also be null).
 */
function expectedLineTokens(lineLabel: string | null): Set<string> | null {
    if (lineLabel === null) {
        return null
    }
    const tokens = new Set<string>()
    let lastPrefix: string | null = null
    for (const raw of lineLabel.split(/\s+/).filter(Boolean)) {
        const m = LINE_TOKEN_RE.exec(raw)
        if (m) {
            lastPrefix = m[1]
            tokens.add(raw)
        } else if (/^\d+$/.test(raw) && lastPrefix !== null) {
            tokens.add(`${lastPrefix}${raw}`)
        } else {
            tokens.add(raw)
        }
    }
    return tokens
}

/** Bot is correct if it picks ANY token from a compound label, or both are null. */
function lineCorrect(expected: string | null, actual: string | null): boolean {
    const tokens = expectedLineTokens(expected)
    if (tokens === null) {
        return actual === null
    }
    return actual !== null && tokens.has(actual)
}

// ---------------------------------------------------------------------------
// Metrics (port of field_metrics) — null treated as a negative prediction.
// ---------------------------------------------------------------------------

interface FieldMetrics {
    accuracy: number
    correct: number
    total: number
    tp: number
    fp: number
    fn: number
    tn: number
    precision: number
    recall: number
    f1: number
}

function fieldMetrics(
    outcomes: RowOutcome[],
    field: keyof Labels,
    correctnessAttr: 'correctStation' | 'correctDirection' | 'correctLine'
): FieldMetrics {
    let tp = 0
    let fp = 0
    let fn = 0
    let tn = 0
    for (const o of outcomes) {
        const exp = o.expected[field]
        const act = o.actual[field]
        if (exp !== null && act !== null) {
            if (o[correctnessAttr]) {
                tp += 1
            } else {
                fp += 1 // picked something, but the wrong one (also counts as a miss)
                fn += 1
            }
        } else if (exp === null && act !== null) {
            fp += 1
        } else if (exp !== null && act === null) {
            fn += 1
        } else {
            tn += 1
        }
    }
    const total = outcomes.length
    const correct = outcomes.filter((o) => o[correctnessAttr]).length
    const precision = tp + fp ? tp / (tp + fp) : 0
    const recall = tp + fn ? tp / (tp + fn) : 0
    const f1 = precision + recall ? (2 * precision * recall) / (precision + recall) : 0
    return { accuracy: total ? correct / total : 0, correct, total, tp, fp, fn, tn, precision, recall, f1 }
}

// ---------------------------------------------------------------------------
// Report (port of build_report)
// ---------------------------------------------------------------------------

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`

function buildReport(opts: {
    outcomes: RowOutcome[]
    durationS: number
    smoke: boolean
    datasetSize: number
    parallel: number
    model: string
}): string {
    const { outcomes, durationS, smoke, datasetSize, parallel, model } = opts
    const n = outcomes.length
    const station = fieldMetrics(outcomes, 'stationId', 'correctStation')
    const direction = fieldMetrics(outcomes, 'directionId', 'correctDirection')
    const line = fieldMetrics(outcomes, 'lineName', 'correctLine')
    const fully = outcomes.filter(fullyCorrect).length
    const errors = outcomes.filter((o) => o.error !== null).length

    const fieldRow = (name: string, m: FieldMetrics): string =>
        `| ${name} | ${pct(m.accuracy)} | ${m.correct}/${m.total} | ${pct(m.precision)} | ` +
        `${pct(m.recall)} | ${pct(m.f1)} | ${m.tp} | ${m.fp} | ${m.fn} | ${m.tn} |`

    const throughput = durationS > 0 && n > 0 ? `${(n / durationS).toFixed(1)} msg/s` : 'n/a'
    const lines: string[] = [
        '# Telegram bot extractor — eval report',
        '',
        `**Mode:** ${smoke ? 'SMOKE' : 'FULL'} (${n} rows of ${datasetSize})  `,
        `**Model:** \`${model}\`  `,
        `**Parallelism:** ${parallel}  `,
        `**Wall time:** ${durationS.toFixed(1)}s (${throughput})  `,
        `**LLM/network errors:** ${errors}`,
        '',
    ]
    if (n === 0) {
        lines.push('_No rows evaluated._', '', 'See `eval_results.json` for the full per-row breakdown.')
        return lines.join('\n') + '\n'
    }
    lines.push(
        '## Headline',
        '',
        `- **Fully correct rows** (all three fields match): ${fully}/${n} = **${pct(fully / n)}**`,
        `- Station accuracy: **${pct(station.accuracy)}**`,
        `- Direction accuracy: **${pct(direction.accuracy)}**`,
        `- Line accuracy: **${pct(line.accuracy)}**`,
        '',
        '## Per-field metrics',
        '',
        'Null is treated as a negative prediction. *Precision* = "when the bot says X, how often ' +
            'is X right?". *Recall* = "when the label has a value, how often does the bot extract ' +
            'it correctly?".',
        '',
        '| Field | Accuracy | Correct | Precision | Recall | F1 | TP | FP | FN | TN |',
        '|---|---|---|---|---|---|---|---|---|---|',
        fieldRow('stationId', station),
        fieldRow('directionId', direction),
        fieldRow('lineName', line),
        '',
        'See `eval_results.json` for the full per-row breakdown.'
    )
    return lines.join('\n') + '\n'
}

// ---------------------------------------------------------------------------
// Runtime plumbing
// ---------------------------------------------------------------------------

/** Load .dev.vars (KEY=VALUE, # comments) into process.env without overriding what's set. */
function loadDevVars(): void {
    const path = join(EVAL_DIR, '..', '.dev.vars')
    if (!existsSync(path)) {
        return
    }
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
        const lineStr = raw.trim()
        if (!lineStr || lineStr.startsWith('#')) {
            continue
        }
        const eq = lineStr.indexOf('=')
        if (eq === -1) {
            continue
        }
        const key = lineStr.slice(0, eq).trim()
        if (!(key in process.env)) {
            process.env[key] = lineStr.slice(eq + 1).trim()
        }
    }
}

/** Deterministic PRNG (mulberry32) so --smoke is repeatable across runs of this harness.
 *  Note: the sample won't match the Python harness's `random.sample` row-for-row. */
function mulberry32(seed: number): () => number {
    let a = seed >>> 0
    return () => {
        a |= 0
        a = (a + 0x6d2b79f5) | 0
        let t = Math.imul(a ^ (a >>> 15), 1 | a)
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }
}

function sample<T>(items: T[], n: number, seed: number): T[] {
    const rng = mulberry32(seed)
    const copy = [...items]
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1))
        ;[copy[i], copy[j]] = [copy[j], copy[i]]
    }
    return copy.slice(0, Math.min(n, copy.length))
}

/** Run async tasks with a bounded concurrency, preserving input order in the output. */
async function mapPool<T, R>(items: T[], limit: number, fn: (item: T, i: number) => Promise<R>): Promise<R[]> {
    const results = new Array<R>(items.length)
    let next = 0
    const worker = async (): Promise<void> => {
        for (;;) {
            const i = next++
            if (i >= items.length) {
                return
            }
            results[i] = await fn(items[i], i)
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
    return results
}

const NULL_RESULT: ExtractionResult = { stationId: null, lineName: null, directionId: null }

async function runOne(
    row: Row,
    index: TransitIndex,
    linePattern: RegExp,
    systemPrompt: string,
    apiKey: string,
    model: string
): Promise<RowOutcome> {
    let result: ExtractionResult = NULL_RESULT
    let error: string | null = null
    try {
        const detectedLine = detectLineName(row.text, index.lineNames, linePattern, index.circularLineNames)
        const parsed = await extractWithMistral(row.text, systemPrompt, apiKey, model)
        result = parsed === null ? NULL_RESULT : resolveExtraction(index, parsed, detectedLine)
    } catch (exc) {
        error = exc instanceof Error ? `${exc.name}: ${exc.message}` : String(exc)
    }

    const expected = row.naive_labels
    return {
        rowId: row.id,
        text: row.text,
        expected: {
            stationId: expected.stationId ?? null,
            directionId: expected.directionId ?? null,
            lineName: expected.lineName ?? null,
        },
        actual: { stationId: result.stationId, directionId: result.directionId, lineName: result.lineName },
        correctStation: result.stationId === (expected.stationId ?? null),
        correctDirection: result.directionId === (expected.directionId ?? null),
        correctLine: lineCorrect(expected.lineName ?? null, result.lineName),
        error,
    }
}

function parseArgs(argv: string[]): { smoke: boolean; n: number; parallel: number; seed: number } {
    const opts = { smoke: false, n: 200, parallel: 1, seed: 42 }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--smoke') opts.smoke = true
        else if (a === '--n') opts.n = Number(argv[++i])
        else if (a === '--parallel') opts.parallel = Number(argv[++i])
        else if (a === '--seed') opts.seed = Number(argv[++i])
    }
    return opts
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv.slice(2))
    loadDevVars()

    const apiKey = process.env.MISTRAL_API_KEY
    if (!apiKey) {
        throw new Error('MISTRAL_API_KEY is not set (env or .dev.vars)')
    }
    const backendUrl = (process.env.BACKEND_URL || 'https://api.freifahren.org').replace(/\/+$/, '')
    const model = process.env.MISTRAL_MODEL || 'mistral-small-latest'
    const cityName = process.env.CITY_NAME || 'Berlin'

    if (!existsSync(DATA_PATH)) {
        throw new Error(
            `Dataset not found: ${DATA_PATH}\n` +
                'It is gitignored — drop in messages.json (rows of ' +
                '{ id, text, naive_labels: { stationId, directionId, lineName } }).'
        )
    }
    const dataset = JSON.parse(readFileSync(DATA_PATH, 'utf8')) as Row[]
    const datasetSize = dataset.length
    const rows = args.smoke ? sample(dataset, args.n, args.seed) : dataset

    const index = await getTransitIndex(backendUrl)
    const linePattern = buildLinePattern(index.lineNames)
    const systemPrompt = buildSystemPrompt(index, cityName)

    console.log(`running ${rows.length} rows with parallel=${args.parallel} model=${model}...`)
    const start = performance.now()
    const outcomes = await mapPool(rows, args.parallel, (row) =>
        runOne(row, index, linePattern, systemPrompt, apiKey, model)
    )
    const durationS = (performance.now() - start) / 1000

    const report = buildReport({ outcomes, durationS, smoke: args.smoke, datasetSize, parallel: args.parallel, model })
    writeFileSync(REPORT_PATH, report)
    writeFileSync(
        RESULTS_PATH,
        JSON.stringify(
            outcomes.map((o) => ({
                id: o.rowId,
                text: o.text,
                expected: o.expected,
                actual: o.actual,
                correct: {
                    stationId: o.correctStation,
                    directionId: o.correctDirection,
                    lineName: o.correctLine,
                    all: fullyCorrect(o),
                },
                error: o.error,
            })),
            null,
            2
        )
    )

    // Echo the headline so a smoke run is useful without opening the file.
    process.stdout.write('\n' + report.split('## Per-field metrics')[0])
    console.log(`done in ${durationS.toFixed(1)}s — report at ${resolve(REPORT_PATH)}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
