import { CITY_DATABASE_SLUGS } from '@freifahren/cities'
import { Hono } from 'hono'
import { z } from 'zod'

import type { Env } from '../../app-env'
import { AppError } from '../../common/errors'

import type { AdminStatus } from './admin-contract'
import { getDashboard, moderationStatus, QUARANTINE_CONFIRMATION, setQuarantine } from './admin-service'

const querySchema = z
    .object({
        from: z.iso.datetime(),
        to: z.iso.datetime(),
        bucket: z.coerce.number().refine((value) => [5, 15, 60, 1440].includes(value)),
        scope: z.enum(['all', ...CITY_DATABASE_SLUGS]).default('all'),
        source: z.string().max(100).optional(),
        flag: z.string().max(200).optional(),
        outcome: z.enum(['positive', 'zero', 'legacy', 'held']).optional(),
        offset: z.coerce.number().int().min(0).max(100_000).default(0),
    })
    .refine(({ from, to, bucket }) => {
        const duration = Date.parse(to) - Date.parse(from)
        return duration > 0 && duration <= 90 * 86_400_000 && duration / (bucket * 60_000) <= 2000
    })

export const adminRoutes = new Hono<Env>()

const decodeBase64Url = (value: string): Uint8Array => {
    const normalized = value.replace(/-/g, '+').replace(/_/g, '/')
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=')
    const binary = atob(padded)
    return Uint8Array.from(binary, (character) => character.charCodeAt(0))
}

const decodeJson = <T>(value: string): T => JSON.parse(new TextDecoder().decode(decodeBase64Url(value))) as T

const verifyAccessJwt = async (token: string, teamDomain: string, audience: string): Promise<boolean> => {
    const [encodedHeader, encodedPayload, encodedSignature] = token.split('.')
    if (encodedHeader === undefined || encodedPayload === undefined || encodedSignature === undefined) return false
    const header = decodeJson<{ alg?: string; kid?: string }>(encodedHeader)
    if (header.alg !== 'RS256' || header.kid === undefined) return false
    const payload = decodeJson<{ iss?: string; aud?: string | string[]; exp?: number; nbf?: number }>(encodedPayload)
    const issuer = new URL(teamDomain).origin
    if (payload.iss !== issuer) return false
    const audiences = Array.isArray(payload.aud) ? payload.aud : [payload.aud]
    const now = Math.floor(Date.now() / 1000)
    if (
        !audiences.includes(audience) ||
        (payload.exp !== undefined && payload.exp <= now) ||
        (payload.nbf !== undefined && payload.nbf > now)
    )
        return false
    const response = await fetch(`${issuer}/cdn-cgi/access/certs`)
    if (!response.ok) return false
    const body = (await response.json()) as { keys?: JsonWebKey[] }
    const key = body.keys?.find((candidate) => (candidate as JsonWebKey & { kid?: string }).kid === header.kid)
    if (key === undefined) return false
    const cryptoKey = await crypto.subtle.importKey('jwk', key, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, [
        'verify',
    ])
    return crypto.subtle.verify(
        { name: 'RSASSA-PKCS1-v1_5' },
        cryptoKey,
        decodeBase64Url(encodedSignature).buffer as ArrayBuffer,
        new TextEncoder().encode(`${encodedHeader}.${encodedPayload}`)
    )
}

adminRoutes.use('*', async (c, next) => {
    c.header('Cache-Control', 'private, no-store')
    c.header('Cloudflare-CDN-Cache-Control', 'no-store')
    if (c.env.ADMIN_AUTH_DISABLED === 'true') {
        await next()
        return
    }
    const accessToken = c.req.header('Cf-Access-Jwt-Assertion')
    const teamDomain = c.env.CF_ACCESS_TEAM_DOMAIN?.replace(/\/$/, '')
    const audience = c.env.CF_ACCESS_AUD
    if (teamDomain === undefined || audience === undefined) {
        throw new AppError({
            message: 'Admin access is not configured',
            statusCode: 503,
            internalCode: 'ADMIN_UNAVAILABLE',
        })
    }
    if (accessToken === undefined) {
        throw new AppError({ message: 'Admin access required', statusCode: 401, internalCode: 'ADMIN_UNAUTHORIZED' })
    }
    try {
        if (!(await verifyAccessJwt(accessToken, teamDomain, audience))) throw new Error('Invalid Access JWT')
    } catch {
        throw new AppError({ message: 'Admin access required', statusCode: 401, internalCode: 'ADMIN_UNAUTHORIZED' })
    }
    await next()
})

adminRoutes.get('/status', async (c) =>
    c.json({
        cities: await moderationStatus(c.env),
        snapshotAt: c.env.ADMIN_DATA_SNAPSHOT_AT ?? null,
    } satisfies AdminStatus)
)

adminRoutes.get('/dashboard', async (c) => {
    const parsed = querySchema.safeParse(c.req.query())
    if (!parsed.success)
        throw new AppError({
            message: 'Choose a valid range of at most 90 days and 2,000 intervals',
            statusCode: 400,
            internalCode: 'VALIDATION_FAILED',
        })
    return c.json(await getDashboard(c.env, parsed.data))
})

adminRoutes.post('/quarantine', async (c) => {
    const input: unknown = await c.req.json().catch(() => null)
    const parsed = z
        .object({ enabled: z.boolean(), confirmation: z.literal(QUARANTINE_CONFIRMATION) })
        .strict()
        .safeParse(input)
    if (!parsed.success)
        throw new AppError({
            message: 'Explicit quarantine confirmation required',
            statusCode: 400,
            internalCode: 'VALIDATION_FAILED',
        })
    const result = await setQuarantine(c.env, parsed.data.enabled)
    c.get('logger').warn(
        {
            enabled: parsed.data.enabled,
            complete: result.complete,
            cities: result.cities.map(({ city, enabled, error }) => ({ city, enabled, error })),
        },
        'Admin changed emergency report quarantine'
    )
    return c.json(result)
})
