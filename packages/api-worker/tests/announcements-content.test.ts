import { describe, expect, it } from 'vitest'

import { ANNOUNCEMENTS } from '../src/modules/announcements/announcements'

describe('shipped announcements', () => {
    it('have unique ids', () => {
        const ids = ANNOUNCEMENTS.map((announcement) => announcement.id)
        expect(new Set(ids).size).toBe(ids.length)
    })

    it('have valid dates and non-empty Markdown bodies', () => {
        for (const { publishedAt, en, de } of ANNOUNCEMENTS) {
            expect(Number.isNaN(Date.parse(publishedAt))).toBe(false)
            for (const content of [en, de]) {
                if (content?.body !== undefined) expect(content.body.trim()).not.toBe('')
            }
        }
    })
})
