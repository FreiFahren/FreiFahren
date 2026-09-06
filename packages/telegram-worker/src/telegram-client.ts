export class TelegramDeliveryError extends Error {
    constructor(
        message: string,
        readonly retryable: boolean,
        readonly retryAfterMs?: number
    ) {
        super(message)
    }
}

const ERROR_DESCRIPTION_LIMIT = 500

export async function sendTelegramMessage(token: string, chatId: string, text: string): Promise<void> {
    let response: Response
    try {
        response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                chat_id: chatId,
                text,
                parse_mode: 'HTML',
                link_preview_options: { is_disabled: false, prefer_large_media: false, show_above_text: false },
            }),
            // Retries after an ambiguous timeout can duplicate a message; Telegram has no idempotency key.
            signal: AbortSignal.timeout(5_000),
        })
    } catch {
        // Fetch errors can contain the URL, which embeds the token.
        throw new TelegramDeliveryError('Telegram request failed or timed out', true)
    }
    const result = (await response.json().catch(() => null)) as {
        ok?: boolean
        description?: unknown
        parameters?: { retry_after?: unknown }
    } | null
    if (response.ok && result?.ok === true) return
    const description =
        typeof result?.description === 'string'
            ? result.description
                  .replaceAll(token, '[REDACTED]')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, ERROR_DESCRIPTION_LIMIT)
            : 'No usable error description'
    const retryAfter = result?.parameters?.retry_after
    const retryAfterMs =
        typeof retryAfter === 'number' && Number.isFinite(retryAfter) && retryAfter >= 0
            ? Math.max(1_000, retryAfter * 1_000)
            : undefined
    throw new TelegramDeliveryError(
        `Telegram notification failed with status ${response.status}: ${description}`,
        response.status === 429 || response.status >= 500,
        retryAfterMs
    )
}
