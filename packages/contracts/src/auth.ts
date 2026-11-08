import { z } from 'zod'

// The auth-worker's SessionsEntrypoint. Consumers forward the request's Authorization header
// verbatim, never the whole request.

// Longer headers are rejected as invalid input, so consumers treat them as signed out rather than
// calling and reading the rejection as an outage.
export const MAX_AUTHORIZATION_LENGTH = 4096

export const sessionRequestSchema = z.object({
    authorization: z.string().max(MAX_AUTHORIZATION_LENGTH),
})

export type SessionRequest = z.infer<typeof sessionRequestSchema>

export const authSessionSchema = z.object({
    user: z.object({ id: z.string().min(1), email: z.string() }),
    session: z.object({ id: z.string().min(1), expiresAt: z.iso.datetime() }),
})

export type AuthSession = z.infer<typeof authSessionSchema>

export type SessionsService = {
    getSession(request: SessionRequest): Promise<AuthSession | null>
}
