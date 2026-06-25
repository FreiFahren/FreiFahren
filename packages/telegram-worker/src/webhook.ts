import type { Env, TelegramMessage } from './types'
import { TelegramUpdate } from './types'
import { processMessage } from './pipeline'
import { reportError } from './observability'

export const WEBHOOK_SECRET_HEADER = 'X-Telegram-Bot-Api-Secret-Token'

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
export function acceptUpdate(update: TelegramUpdate, allowedChatId: string): string | null {
    const message = effectiveMessage(update)
    if (message === null) {
        return null
    }
    const chat = message.chat
    if (!chat || String(chat.id) !== allowedChatId) {
        return null
    }
    if (isCommand(message)) {
        return null
    }
    return messageReportText(message)
}

type Processor = (text: string, env: Env) => Promise<void>

/**
 * Verify the Telegram secret, filter, then process in the background via waitUntil so we
 * return 200 instantly and Telegram never re-delivers. There's no retry: a failed pipeline
 * run (e.g. a Mistral timeout) is reported and the message is dropped — we monitor error
 * rates instead. Only a bad secret yields a 401; everything else acks with 200.
 */
export async function handleWebhook(
    request: Request,
    env: Env,
    ctx: ExecutionContext,
    process: Processor = processMessage,
): Promise<Response> {
    if (request.headers.get(WEBHOOK_SECRET_HEADER) !== env.TELEGRAM_WEBHOOK_SECRET) {
        return new Response('unauthorized', { status: 401 })
    }

    let update: TelegramUpdate
    try {
        update = TelegramUpdate.parse(await request.json())
    } catch {
        return new Response('ok', { status: 200 })
    }

    const text = acceptUpdate(update, env.TELEGRAM_REPORT_CHAT_ID)
    if (text) {
        ctx.waitUntil(
            process(text, env).catch((err) =>
                reportError('telegram pipeline failed', err, { text: text.slice(0, 80) }),
            ),
        )
    }
    return new Response('ok', { status: 200 })
}
