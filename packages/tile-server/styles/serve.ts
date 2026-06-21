// Local static server for the PMTiles artifacts in `dist/`. Run with bun (`bun serve.ts [root] [port]`).
//
// Serves HTTP Range requests (206 + Content-Range) via `Bun.file().slice()` — exactly what pmtiles.js
// needs — so it's a dependency-free stand-in for the production R2 edge during local development.
import { resolve, join } from 'node:path'

const root = resolve(process.argv[2] ?? 'dist')
const port = Number(process.argv[3] ?? 3000)

const CORS: Record<string, string> = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'range, if-match',
    'Access-Control-Expose-Headers': 'etag, content-range, content-length, accept-ranges',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
}

Bun.serve({
    port,
    async fetch(req) {
        if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })

        const { pathname } = new URL(req.url)
        const filePath = resolve(join(root, decodeURIComponent(pathname)))
        // Block path traversal outside the served root.
        if (filePath !== root && !filePath.startsWith(root + '/')) {
            return new Response('forbidden', { status: 403, headers: CORS })
        }

        const file = Bun.file(filePath)
        if (!(await file.exists())) return new Response('not found', { status: 404, headers: CORS })

        const size = file.size
        const headers: Record<string, string> = {
            ...CORS,
            'Accept-Ranges': 'bytes',
            'Content-Type': file.type,
        }

        const range = req.headers.get('range')
        const match = range && /^bytes=(\d+)-(\d*)$/.exec(range)
        if (match) {
            const start = Number(match[1])
            const end = match[2] ? Number(match[2]) : size - 1
            return new Response(file.slice(start, end + 1), {
                status: 206,
                headers: {
                    ...headers,
                    'Content-Range': `bytes ${start}-${end}/${size}`,
                    'Content-Length': String(end - start + 1),
                },
            })
        }

        return new Response(file, { headers: { ...headers, 'Content-Length': String(size) } })
    },
})

console.log(`range server on http://localhost:${port} (root=${root})`)
