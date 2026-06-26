import type { Env } from './types'
import { handleWebhook } from './webhook'
import { handleReportForward } from './forwarding'

export default {
    async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
        const url = new URL(request.url)

        if (request.method === 'POST' && url.pathname === '/telegram/webhook') {
            return handleWebhook(request, env, ctx)
        }
        if (request.method === 'POST' && url.pathname === '/report') {
            return handleReportForward(request, env)
        }
        if (request.method === 'GET' && url.pathname === '/health') {
            return new Response('ok', { status: 200 })
        }

        return new Response('not found', { status: 404 })
    },
} satisfies ExportedHandler<Env>
