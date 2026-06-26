export const MINIMUM_MESSAGE_LENGTH = 3
export const MAXIMUM_MESSAGE_LENGTH = 250
export const MAX_EMOJIS = 5

// Emoji range: Emoticons block, U+1F600–U+1F64F.
const EMOJI_PATTERN = /[\u{1f600}-\u{1f64f}]/gu

export function isSpam(text: string): boolean {
    if (text.length < MINIMUM_MESSAGE_LENGTH) {
        return true
    }
    if (text.includes('?')) {
        return true
    }
    if (text.length > MAXIMUM_MESSAGE_LENGTH) {
        return true
    }
    if (text.includes('http')) {
        return true
    }
    const emojis = text.match(EMOJI_PATTERN)
    return (emojis?.length ?? 0) > MAX_EMOJIS
}
