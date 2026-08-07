import type { Context } from 'hono'

import type { Env } from '../../app-env'

import { resolveClientIdentity } from './client-identity'
import type { ViewerContext } from './reports-service'

/*
 * Builds the read-side view of who is asking: the trust a station needs before its reports are
 * shown, plus the requester's own signature so that its own reports are shown to it regardless.
 *
 * Lives here rather than in client-identity.ts to keep that module free of any dependency on the
 * reports service, which already depends on it.
 */
export const resolveViewer = async (c: Context<Env>): Promise<ViewerContext> => {
    const config = c.get('config')

    /*
     * Skip the HMAC entirely when nothing is being suppressed. At a threshold of 0 every report is
     * visible to everyone, so the viewer's identity cannot change the answer and computing it would
     * be work on every read for no effect.
     */
    if (config.minStationTrust <= 0) return { minStationTrust: 0 }

    const identity = await resolveClientIdentity(c, { secret: config.clientHashSecret })

    return {
        minStationTrust: config.minStationTrust,
        clientHash: identity.clientHash ?? undefined,
        onSuppressed: () => c.set('reportsUncacheable', true),
    }
}
