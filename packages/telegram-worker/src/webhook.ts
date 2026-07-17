import type { Env, TelegramMessage } from './types'
import { TelegramUpdate } from './types'
import { processMessage } from './pipeline'
import { reportError } from './observability'
import { cityForChat } from './config'
import { setTag } from '@sentry/cloudflare'
import type { CitySlug } from '@freifahren/cities'

export const WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token'
type WebhookContext = Pick<ExecutionContext, 'waitUntil'>

function effectiveMessage(update: TelegramUpdate): TelegramMessage | null {
    return update.message ?? update.edited_message ?? update.channel_post ?? update.edited_channel_post ?? null
}

function messageReportText(message: TelegramMessage): string | null {
    const text = message.text ?? message.caption ?? null
    return text || null
}

function isCommand(message: TelegramMessage): boolean {
    const entities = message.entities ?? message.caption_entities ?? []
    if (entities.some((e) => e.type === 'bot_command' && e.offset === 0)) {
        return true
    }
    const text = message.text ?? message.caption ?? ''
    return text.startsWith('/')
}

// Filter to the allowed chat (text/caption, non-command). Returns the text to process, or
// null to ignore. Pure, so the filtering rules are testable without the pipeline.
export function acceptUpdate(update: TelegramUpdate, env: Env): { text: string; city: CitySlug } | null {
    const message = effectiveMessage(update)
    if (message === null) {
        return null
    }
    const chat = message.chat
    const city = chat ? cityForChat(env, String(chat.id)) : null
    if (!city) {
        return null
    }
    if (isCommand(message)) {
        return null
    }
    const text = messageReportText(message)
    return text === null ? null : { text, city: city.slug as CitySlug }
}

type Processor = (text: string, env: Env, city: CitySlug) => Promise<void>

/**
 * Verify the Telegram secret, filter, then process in the background via waitUntil so we
 * return 200 instantly and Telegram never re-delivers. There's no retry: a failed pipeline
 * run (e.g. a Mistral timeout) is reported and the message is dropped — we monitor error
 * rates instead. Only a bad secret yields a 401; everything else acks with 200.
 */
export async function handleWebhook(
    request: Request,
    env: Env,
    ctx: WebhookContext,
    process: Processor = processMessage,
): Promise<Response> {
    if (request.headers.get(WEBHOOK_SECRET_HEADER) !== env.TELEGRAM_WEBHOOK_SECRET) {
        console.warn('Webhook rejected: bad secret token')
        return new Response('unauthorized', { status: 401 })
    }

    let update: TelegramUpdate
    try {
        update = TelegramUpdate.parse(await request.json())
    } catch {
        console.warn('Webhook ignored: unparseable update body')
        return new Response('ok', { status: 200 })
    }

    const accepted = acceptUpdate(update, env)
    if (accepted) {
        setTag('city', accepted.city)
        ctx.waitUntil(
            // Pass the length, not the text: the privacy policy promises we don't store message
            // content, and reportError persists to Sentry. Length still helps correlate failures.
            process(accepted.text, env, accepted.city).catch((err) =>
                reportError('telegram pipeline failed', err, { length: accepted.text.length, city: accepted.city }),
            ),
        )
    }
    return new Response('ok', { status: 200 })
}
