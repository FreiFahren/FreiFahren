import type { Env } from './types'
import { readConfig } from './config'
import { isSpam } from './spam'
import { getTransitIndex } from './transit'
import {
    buildLinePattern,
    buildSystemPrompt,
    detectLineName,
    extractWithMistral,
    extractionToLog,
    resolveExtraction,
} from './extractor'
import { postReport, reportIdentifiers } from './reporting'

/**
 * The extract -> resolve -> submit chain. Throws on failure
 * (Mistral or backend) for the caller to report; returns normally when there's nothing to
 * submit (spam, no extraction, no station). Runs in the background via waitUntil — no retry.
 */
export async function processMessage(text: string, env: Env): Promise<void> {
    if (isSpam(text)) {
        console.info('Skipped as spam:', text.slice(0, 80))
        return
    }

    const cfg = readConfig(env)
    const index = await getTransitIndex(cfg.backendUrl)

    const linePattern = buildLinePattern(index.lineNames)
    const detectedLine = detectLineName(text, index.lineNames, linePattern, index.circularLineNames)

    const systemPrompt = buildSystemPrompt(index, cfg.cityName)
    const parsed = await extractWithMistral(text, systemPrompt, cfg.mistralApiKey, cfg.mistralModel)
    if (parsed === null) {
        console.info('No extraction produced (LLM error or unparseable)')
        return
    }

    const result = resolveExtraction(index, parsed, detectedLine)
    const ids = reportIdentifiers(index, result)
    if (ids === null) {
        return
    }

    console.info('Submitting report:', extractionToLog(result))
    await postReport(cfg.backendUrl, cfg.reportPassword, ids)
}
