import { type AuthSession, authSessionSchema, MAX_AUTHORIZATION_LENGTH } from '@freifahren/contracts/auth'
import type { Context } from 'hono'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'

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

    let result: unknown
    try {
        result = await c.env.AUTH.getSession({ authorization })
    } catch (error) {
        throw authUnavailable(error)
    }
    // A response that doesn't match is a contract bug, not an outage: it surfaces as a 500.
    return authSessionSchema.nullable().parse(result)
}

export const requireSession = async (c: Context<Env>): Promise<AuthSession> => {
    const session = await resolveSession(c)
    if (session === null) {
        throw new AppError({ message: 'Sign-in required', statusCode: 401, internalCode: 'UNAUTHENTICATED' })
    }
    return session
}
