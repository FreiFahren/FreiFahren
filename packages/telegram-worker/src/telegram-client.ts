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
            // A timeout may occur after Telegram posts; retrying could duplicate the message.
            signal: AbortSignal.timeout(5_000),
        })
    } catch {
        // Fetch errors can contain the URL, which embeds the token.
        throw new Error('Telegram request failed or timed out')
    }
    const result = (await response.json().catch(() => null)) as { ok?: boolean; description?: unknown } | null
    if (response.ok && result?.ok === true) return
    const description =
        typeof result?.description === 'string'
            ? result.description
                  .replaceAll(token, '[REDACTED]')
                  .replace(/\s+/g, ' ')
                  .trim()
                  .slice(0, ERROR_DESCRIPTION_LIMIT)
            : 'No usable error description'
    throw new Error(`Telegram notification failed with status ${response.status}: ${description}`)
}
