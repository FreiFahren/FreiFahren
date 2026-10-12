// Mirrors the private auth-worker's `SessionsEntrypoint` (its src/contracts.ts).
export type SessionRequest = {
    authorization: string
}

export type AuthSession = {
    user: { id: string; email: string; name: string | null }
    session: { id: string; expiresAt: string }
}

export type SessionsService = {
    getSession(request: SessionRequest): Promise<AuthSession | null>
}
