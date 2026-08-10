import type { D1Database } from '@cloudflare/workers-types'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Logger } from '../../common/logger'
import { DbConnection, reports } from '../../db'

/*
 * Deliberately *not* here: anything asking whether the sighting itself is plausible. A report from a
 * station that rarely sees one is the most valuable report we get, and a filter built on the
 * historical distribution would suppress exactly those. Flags describe the submission, never whether
 * inspectors are likely to be there.
 */
export const trustFlagSchema = z.object({
    id: z.string().min(1).max(64),
    /*
     * A SELECT returning one row, one column, truthy when the flag fires. `?1` is bound to the new
     * report's id. Expressing the comparison inside the statement (`SELECT count(*) > 10 …`) keeps
     * thresholds editable alongside the query instead of compiled in here.
     */
    sql: z.string().min(1),
    /*
     * How much firing costs. Intended to be an inverse-document-frequency over a reference corpus:
     * a flag that fires on most honest traffic is worth almost nothing, which is what makes new
     * flags cheap to invent — a bad one self-limits rather than poisoning every score.
     */
    weight: z.number().positive().finite(),
    enabled: z.boolean(),
    // Part of the schema, not a stray key: z.object strips what it does not know.
    description: z.string().optional(),
})

export type TrustFlag = z.infer<typeof trustFlagSchema>

// Stops a predicate pasted in under pressure from mutating the table.
const isReadOnlyStatement = (statement: string): boolean => /^\s*select\b/i.test(statement) && !statement.includes(';')

// Unset disables scoring — dev, previews, tests — leaving trust null, which reads as unscored.
export const loadTrustFlags = (raw: string | undefined, logger: Logger): TrustFlag[] => {
    // A leftover KV binding of the same name arrives as an object, and scoring must not throw here.
    if (typeof raw !== 'string' || raw.trim() === '') return []

    let decoded: unknown
    try {
        decoded = JSON.parse(raw)
    } catch (error) {
        logger.error(
            { reason: error instanceof Error ? error.message : String(error) },
            'Trust flag definitions are not valid JSON'
        )
        return []
    }

    const parsed = z.array(trustFlagSchema).safeParse(decoded)
    if (!parsed.success) {
        logger.error({ issues: parsed.error.issues.length }, 'Trust flag definitions are malformed')
        return []
    }

    // One bad definition drops itself rather than disarming the whole set.
    return parsed.data.filter((flag) => {
        if (!flag.enabled) return false
        if (!isReadOnlyStatement(flag.sql)) {
            logger.error({ flagId: flag.id }, 'Trust flag rejected: not a single read-only SELECT')
            return false
        }
        return true
    })
}

export type TrustAssessment = { trust: number; fired: string[] }

/*
 * Trust falls off as 1/(1 + cost), so an honest report scores 1 and every flag makes the report
 * need proportionally more corroboration before it counts for anything. It cannot reach zero,
 * which is deliberate: a flagged report is one that has to be confirmed by somebody else, not one
 * that has been decided about.
 */
export const trustFromCost = (cost: number): number => 1 / (1 + cost)

export const assessReport = async (
    d1: D1Database,
    flags: TrustFlag[],
    reportId: number,
    logger: Logger
): Promise<TrustAssessment> => {
    const fired: string[] = []
    let cost = 0

    for (const flag of flags) {
        try {
            const row = await d1.prepare(flag.sql).bind(reportId).first<Record<string, unknown>>()
            const value = row === null ? undefined : Object.values(row)[0]
            if (value !== undefined && value !== null && value !== 0 && value !== false && value !== '') {
                fired.push(flag.id)
                cost += flag.weight
            }
        } catch (error) {
            /*
             * A broken predicate must not cost the report its score. It is logged and skipped, which
             * makes a flag that never fires and always errors visible as a rate rather than as
             * silence.
             */
            logger.error(
                { flagId: flag.id, reason: error instanceof Error ? error.message : String(error) },
                'Trust flag failed to evaluate'
            )
        }
    }

    return { trust: trustFromCost(cost), fired }
}

/*
 * Runs after the response, via waitUntil: nothing reads trust synchronously, and a report that is
 * already committed must not wait on the flags. Until this lands the row's trust is null, which
 * reads as unscored — not as untrusted.
 *
 * Returns the trust it assigned, or null if it scored nothing. The caller needs that: a report is
 * briefly visible as unscored, and a score below 1 can change what the station should show.
 */
export const scoreReportInBackground = async (
    db: DbConnection,
    d1: D1Database,
    flagDefinitions: string | undefined,
    logger: Logger,
    reportId: number
): Promise<number | null> => {
    const flags = loadTrustFlags(flagDefinitions, logger)
    if (flags.length === 0) return null

    const { trust, fired } = await assessReport(d1, flags, reportId, logger)

    await db
        .update(reports)
        .set({ trust, trustFlags: fired.length === 0 ? null : fired.join(',') })
        .where(eq(reports.reportId, reportId))

    logger.info({ reportId, trust, fired, flagCount: flags.length }, 'Report trust scored')
    return trust
}
