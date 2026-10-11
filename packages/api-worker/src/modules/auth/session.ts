import type { Context } from 'hono'
import { z } from 'zod'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'

import type { AuthSession } from './auth-contract'

const authSessionSchema = z
    .object({
        user: z.object({ id: z.string(), email: z.string(), name: z.string().nullable() }),
        session: z.object({ id: z.string(), expiresAt: z.string() }),
    })
    .nullable()

// The auth-worker's RPC rejects longer headers as invalid input, which would read as an outage here.
const MAX_AUTHORIZATION_LENGTH = 4096

const authUnavailable = (error?: unknown) =>
    new AppError({
        message: 'Accounts are unavailable',
        statusCode: 503,
        internalCode: 'AUTH_UNAVAILABLE',
        description: error instanceof Error ? error.message : undefined,
    })

export const resolveSession = async (c: Context<Env>): Promise<AuthSession | null> => {
    const authorization = c.req.header('Authorization')
    if (authorization === undefined || authorization.length > MAX_AUTHORIZATION_LENGTH) return null
    if (c.env.AUTH === undefined) throw authUnavailable()

    try {
        return authSessionSchema.parse(await c.env.AUTH.getSession({ authorization }))
    } catch (error) {
        throw authUnavailable(error)
    }
}

export const requireSession = async (c: Context<Env>): Promise<AuthSession> => {
    const session = await resolveSession(c)
    if (session === null) {
        throw new AppError({ message: 'Sign-in required', statusCode: 401, internalCode: 'UNAUTHENTICATED' })
    }
    return session
}
