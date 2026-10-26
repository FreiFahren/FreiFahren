export type SessionRequest = {
    authorization: string
}

export type AuthSession = {
    user: { id: string; email: string }
    session: { id: string; expiresAt: string }
}

export type SessionsService = {
    getSession(request: SessionRequest): Promise<AuthSession | null>
}
