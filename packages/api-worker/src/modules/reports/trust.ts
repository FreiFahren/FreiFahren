import type { D1Database, KVNamespace } from '@cloudflare/workers-types'
import { eq } from 'drizzle-orm'
import { z } from 'zod'

import type { Logger } from '../../common/logger'
import { DbConnection, reports } from '../../db'

/*
 * A report earns trust on its own. Each flag is a read-only SQL predicate evaluated against the
 * report that was just written; the ones that fire subtract from its trust.
 *
 * The predicates live in KV rather than in this file because a spam pattern is discovered while it
 * is happening, and a deploy is the wrong unit of latency for that. Adding a flag is a KV write.
 *
 * Deliberately *not* here: anything asking whether the sighting itself is plausible. A report from
 * a station that rarely sees one is the most valuable report we get, and a filter built on the
 * historical distribution would suppress exactly those. Flags describe the submission — what the
 * client announced, what else arrived alongside it — never whether inspectors are likely to be
 * there.
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
})

export type TrustFlag = z.infer<typeof trustFlagSchema>

export const TRUST_FLAGS_KEY = 'flags'

/*
 * Read-only and single-statement. These predicates come from KV, so whoever can write that
 * namespace can already run code here — this is not a privilege boundary, and it is not pretending
 * to be one. It is a guard against a typo in an operator's ad-hoc query truncating the reports
 * table at three in the morning.
 */
const isReadOnlyStatement = (statement: string): boolean => /^\s*select\b/i.test(statement) && !statement.includes(';')

/*
 * Cached per isolate for a minute. A new flag is live within that; the alternative is a KV read on
 * every report, which buys freshness nobody is waiting on.
 */
const FLAGS_CACHE_TTL_SECONDS = 60

export const loadTrustFlags = async (kv: KVNamespace | undefined, logger: Logger): Promise<TrustFlag[]> => {
    if (kv === undefined) return []

    const raw = await kv.get(TRUST_FLAGS_KEY, { type: 'json', cacheTtl: FLAGS_CACHE_TTL_SECONDS })
    if (raw === null) return []

    const parsed = z.array(trustFlagSchema).safeParse(raw)
    if (!parsed.success) {
        logger.error({ issues: parsed.error.issues.length }, 'Trust flag definitions are malformed')
        return []
    }

    /*
     * One bad definition drops itself rather than the whole set: a malformed flag added mid-incident
     * must not silently disarm the flags that were already working.
     */
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
    kv: KVNamespace | undefined,
    logger: Logger,
    reportId: number
): Promise<number | null> => {
    const flags = await loadTrustFlags(kv, logger)
    if (flags.length === 0) return null

    const { trust, fired } = await assessReport(d1, flags, reportId, logger)

    await db
        .update(reports)
        .set({ trust, trustFlags: fired.length === 0 ? null : fired.join(',') })
        .where(eq(reports.reportId, reportId))

    logger.info({ reportId, trust, fired, flagCount: flags.length }, 'Report trust scored')
    return trust
}
