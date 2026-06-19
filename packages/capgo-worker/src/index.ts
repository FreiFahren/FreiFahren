/**
 * Self-hosted Capgo update server for the FreiFahren Capacitor app.
 *
 * The @capgo/capacitor-updater plugin (autoUpdate mode) POSTs the installed app's info to /updates
 * on each launch. We answer with the head bundle of the device's channel, or an empty body when it
 * is already current. Bundles live in R2 and are streamed back through /bundles/<version>.zip.
 *
 * There is no upload path here: CI writes bundles and the channel manifest straight to R2. The
 * Worker is read-only.
 */

interface Env {
    BUNDLES: R2Bucket
}

/** Stored at channels/<channel>.json in R2; written by CI on every release. */
interface ChannelManifest {
    version: string
    checksum: string
}

/** Subset of the Capgo plugin's request body we rely on. */
interface UpdateRequest {
    version_name?: string
}

const ORIGIN = 'https://updates.freifahren.org'

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url)

        if (request.method === 'POST' && url.pathname === '/updates') {
            return handleUpdateCheck(request, env)
        }

        if (request.method === 'GET' && url.pathname.startsWith('/bundles/')) {
            return serveBundle(url.pathname.slice(1), env)
        }

        if (url.pathname === '/health') return new Response('ok')

        return new Response('Not found', { status: 404 })
    },
}

async function handleUpdateCheck(request: Request, env: Env): Promise<Response> {
    const info = (await request.json().catch(() => ({}))) as UpdateRequest

    // Single production channel for now; the manifest key is channel-addressed so adding `beta`
    // later is a config change, not a rewrite.
    const object = await env.BUNDLES.get('channels/production.json')
    if (!object) return json({})

    const manifest = (await object.json()) as ChannelManifest

    // version_name is the device's active bundle ("builtin" for the assets shipped in the binary).
    // Serving whenever it differs from the channel head — rather than only when strictly newer —
    // makes promotion and rollback symmetric: repointing the manifest at an older bundle pushes that
    // bundle out as the next "update". The plugin blacklists bundles that fail to boot, so a bad
    // bundle won't loop.
    if (info.version_name === manifest.version) return json({})

    return json({
        version: manifest.version,
        url: `${ORIGIN}/bundles/${manifest.version}.zip`,
        checksum: manifest.checksum,
    })
}

async function serveBundle(key: string, env: Env): Promise<Response> {
    const object = await env.BUNDLES.get(key)
    if (!object) return new Response('Not found', { status: 404 })

    return new Response(object.body, {
        headers: {
            'content-type': 'application/zip',
            etag: object.httpEtag,
            // Bundle keys are immutable (version is in the name), so they cache forever.
            'cache-control': 'public, max-age=31536000, immutable',
        },
    })
}

function json(body: unknown): Response {
    return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
    })
}
