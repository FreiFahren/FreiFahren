import type { CitySlug } from '@freifahren/cities'

export const ANNOUNCEMENT_LANGUAGES = ['en', 'de'] as const
export type AnnouncementLanguage = (typeof ANNOUNCEMENT_LANGUAGES)[number]

export type AnnouncementContent = {
    title: string
    description: string
    /** Optional Markdown, rendered to HTML once when the worker loads. */
    body?: string
}

export type Announcement = {
    /** Stable slug; it is the deep-link path and the client's read-state key, so never reuse one. */
    id: string
    /** ISO 8601 with offset, e.g. `2026-09-24T10:00:00Z`. Sets the order (newest first). */
    publishedAt: string
    /** Omitted means the announcement is shown in every city. */
    cities?: readonly CitySlug[]
    en: AnnouncementContent
    /** Falls back to English when omitted. */
    de?: AnnouncementContent
}
