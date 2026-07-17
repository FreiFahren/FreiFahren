import type { Env } from './types'
import { profileFor, readConfigForCity } from './config'
import type { CitySlug } from '@freifahren/cities'
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
export async function processMessage(text: string, env: Env, city: CitySlug): Promise<void> {
    if (isSpam(text)) {
        // Never log the message text — the privacy policy promises we don't store it, and logs are
        // persisted in Sentry. Length is a non-identifying signal that's still useful for triage.
        console.info('Skipped as spam', { length: text.length })
        return
    }

    const cfg = readConfigForCity(env, city)
    const profile = profileFor(cfg.city.slug)
    const index = await getTransitIndex(cfg.backendUrl, profile, cfg.city.slug)

    const linePattern = buildLinePattern(index.lineNames)
    const detectedLine = detectLineName(text, index.lineNames, linePattern, index.circularLineNames, profile)

    const systemPrompt = buildSystemPrompt(index, profile)
    const parsed = await extractWithMistral(text, systemPrompt, cfg.mistralApiKey, cfg.mistralModel)
    if (parsed === null) {
        console.info('No extraction produced (LLM error or unparseable)')
        return
    }

    const result = resolveExtraction(index, parsed, detectedLine, profile)
    const ids = reportIdentifiers(index, result)
    if (ids === null) {
        return
    }

    console.info('Submitting report:', extractionToLog(result))
    await postReport(cfg.backendUrl, cfg.reportPassword, ids, cfg.city.slug)
}
