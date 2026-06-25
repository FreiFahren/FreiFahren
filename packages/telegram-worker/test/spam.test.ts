import { describe, expect, it } from 'vitest'
import { MAX_EMOJIS, MAXIMUM_MESSAGE_LENGTH, MINIMUM_MESSAGE_LENGTH, isSpam } from '../src/spam'

describe('isSpam — ham', () => {
    it.each([
        ['typical_report', 'U2 alex 2x BOS'],
        ['short_but_valid', 'a'.repeat(MINIMUM_MESSAGE_LENGTH)],
        ['long_but_valid', 'a'.repeat(MAXIMUM_MESSAGE_LENGTH)],
        ['emoji_at_threshold', 'report ' + '😀'.repeat(MAX_EMOJIS)],
    ])('does not flag %s', (_label, text) => {
        expect(isSpam(text)).toBe(false)
    })
})

describe('isSpam — spam', () => {
    it.each([
        ['empty', ''],
        ['one_char', 'a'],
        ['below_minimum', 'a'.repeat(MINIMUM_MESSAGE_LENGTH - 1)],
        ['above_maximum', 'a'.repeat(MAXIMUM_MESSAGE_LENGTH + 1)],
        ['contains_question_mark', 'kontrolleur?'],
        ['contains_http', 'see http://example.com'],
        ['contains_https', 'see https://example.com'],
        ['too_many_emojis', '😀'.repeat(MAX_EMOJIS + 1)],
    ])('flags %s', (_label, text) => {
        expect(isSpam(text)).toBe(true)
    })
})
