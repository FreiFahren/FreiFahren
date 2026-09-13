import { existsSync, readFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { profileFor } from '../src/config'
import {
    buildLinePattern,
    buildSystemPrompt,
    detectLineName,
    resolveExtraction,
    type ExtractionResult,
} from '../src/extractor'
import { isSpam } from '../src/spam'
import { getTransitIndex, resolveLineVariant } from '../src/transit'
import { appendJsonl, extractWithRetry, loadDevVars, loadJsonlIds, mapPool } from './shared'

const EVAL_DIR = dirname(fileURLToPath(import.meta.url))
const NULL_RESULT: ExtractionResult = { stationId: null, lineName: null, directionId: null }

type SourceMessage = {
    id: number
    timestamp: string
    timestampUtc: string
    text: string | null
}

type SourceFile = { messages: SourceMessage[] }

type ExtractRow = {
    id: string
    timestamp: string
    timestampUtc: string
    text: string | null
    skip: 'empty' | 'spam' | null
    stationId: string | null
    directionId: string | null
    lineName: string | null
    lineId: string | null
    error: string | null
}

function parseArgs(argv: string[]): { parallel: number; source?: string; out?: string } {
    const opts: { parallel: number; source?: string; out?: string } = { parallel: 8 }
    for (let i = 0; i < argv.length; i++) {
        const a = argv[i]
        if (a === '--parallel') opts.parallel = Number(argv[++i])
        else if (a === '--source') opts.source = argv[++i]
        else if (a === '--out') opts.out = argv[++i]
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
    const cityName = process.env.CITY_NAME || 'Leipzig'
    const sourceName =
        args.source ??
        join(EVAL_DIR, '../../../Attachments-Telegram Chat since 1.01.2025 Leipzig/messages.leipzig.json')
    const sourcePath = isAbsolute(sourceName) ? sourceName : join(EVAL_DIR, sourceName)
    const outPath = args.out
        ? isAbsolute(args.out)
            ? args.out
            : join(EVAL_DIR, args.out)
        : join(EVAL_DIR, `extract.${cityName.toLowerCase()}.jsonl`)
    if (!existsSync(sourcePath)) {
        throw new Error(`Source not found: ${sourcePath}`)
    }

    const parsed = JSON.parse(readFileSync(sourcePath, 'utf8')) as SourceFile
    const doneIds = loadJsonlIds(outPath)
    const pending = parsed.messages
        .filter((msg) => !doneIds.has(String(msg.id)))
        .sort((a, b) => {
            const byTime = Date.parse(b.timestampUtc) - Date.parse(a.timestampUtc)
            return byTime !== 0 ? byTime : b.id - a.id
        })
    const total = parsed.messages.length

    const profile = profileFor(cityName)
    const index = await getTransitIndex(backendUrl, profile, cityName.toLowerCase(), { fetch })
    const linePattern = buildLinePattern(index.lineNames)
    const systemPrompt = buildSystemPrompt(index, profile)

    console.log(
        `extract ${pending.length} remaining of ${total} (checkpoint ${doneIds.size}) parallel=${args.parallel} model=${model} out=${outPath}`,
    )
    const start = performance.now()
    let completed = doneIds.size

    await mapPool(pending, args.parallel, async (msg) => {
        const row: ExtractRow = {
            id: String(msg.id),
            timestamp: msg.timestamp,
            timestampUtc: msg.timestampUtc,
            text: msg.text,
            skip: null,
            stationId: null,
            directionId: null,
            lineName: null,
            lineId: null,
            error: null,
        }
        if (msg.text === null || msg.text.trim() === '') {
            row.skip = 'empty'
        } else if (isSpam(msg.text)) {
            row.skip = 'spam'
        } else {
            try {
                const detectedLine = detectLineName(
                    msg.text,
                    index.lineNames,
                    linePattern,
                    index.circularLineNames,
                    profile,
                )
                const parsedNames = await extractWithRetry(msg.text, systemPrompt, apiKey, model)
                const result = parsedNames === null ? NULL_RESULT : resolveExtraction(index, parsedNames, detectedLine, profile)
                row.stationId = result.stationId
                row.directionId = result.directionId
                row.lineName = result.lineName
                row.lineId =
                    result.lineName !== null && result.stationId !== null
                        ? resolveLineVariant(index, result.lineName, result.stationId)
                        : result.lineName !== null
                          ? resolveLineVariant(index, result.lineName, null)
                          : null
            } catch (exc) {
                row.error = exc instanceof Error ? `${exc.name}: ${exc.message}` : String(exc)
            }
        }
        appendJsonl(outPath, row)
        completed += 1
        const elapsed = (performance.now() - start) / 1000
        const rate = elapsed > 0 ? (completed - doneIds.size) / elapsed : 0
        const left = total - completed
        const eta = rate > 0 ? Math.round(left / rate) : 0
        const status = row.skip ?? row.error ?? (row.stationId ? row.stationId : 'no-station')
        console.log(
            `[${completed}/${total}] id=${row.id} ${status} line=${row.lineName ?? '-'} ${rate.toFixed(1)}/s eta=${eta}s`,
        )
        return row
    })

    const durationS = (performance.now() - start) / 1000
    console.log(`done in ${durationS.toFixed(1)}s — ${resolve(outPath)}`)
}

main().catch((err) => {
    console.error(err)
    process.exit(1)
})
