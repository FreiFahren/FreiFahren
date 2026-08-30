import type { Context } from 'hono'

import type { Env } from '../../app-env'
import { resolveReportViewer } from '../report-gate'

import type { ViewerContext } from './reports-service'

/*
 * Builds the read-side view of who is asking: the trust a station needs before its reports are
 * shown, plus the requester's own signature so that its own reports are shown to it regardless.
 *
 * The private gate returns the opaque identity and threshold; this module only attaches the
 * public response-cache behavior.
 */
export const resolveViewer = async (c: Context<Env>): Promise<ViewerContext> => {
    const viewer = await resolveReportViewer(c)

    return {
        minStationTrust: viewer.minStationTrust,
        clientHash: viewer.clientHash ?? undefined,
        onSuppressed: () => c.set('reportsUncacheable', true),
    }
}
