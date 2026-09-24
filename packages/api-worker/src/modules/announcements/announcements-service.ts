import { marked } from 'marked'

import { AppError } from '../../common/errors'

import { ANNOUNCEMENTS } from './announcements'
import type { Announcement, AnnouncementContent, AnnouncementLanguage } from './announcements-types'

export type AnnouncementView = {
    id: string
    publishedAt: string
    title: string
    description: string
    bodyHtml: string | null
}

type LocalizedAnnouncement = Pick<Announcement, 'cities'> & Record<AnnouncementLanguage, AnnouncementView>

const localize = ({ id, publishedAt, cities, en, de }: Announcement): LocalizedAnnouncement => {
    const view = ({ title, description, body }: AnnouncementContent): AnnouncementView => ({
        id,
        publishedAt,
        title,
        description,
        bodyHtml: body === undefined ? null : marked.parse(body.trim(), { async: false }).trim(),
    })
    const english = view(en)
    return { cities, en: english, de: de === undefined ? english : view(de) }
}

// Rendered once per isolate. Insertion order keeps iteration newest first for the list.
const ANNOUNCEMENTS_BY_ID = new Map(
    ANNOUNCEMENTS.toSorted((a, b) => Date.parse(b.publishedAt) - Date.parse(a.publishedAt)).map((announcement) => [
        announcement.id,
        localize(announcement),
    ])
)

const visibleIn = (announcement: LocalizedAnnouncement, citySlug: string) =>
    announcement.cities?.some((city) => city === citySlug) ?? true

export const listAnnouncements = (citySlug: string, lang: AnnouncementLanguage) =>
    [...ANNOUNCEMENTS_BY_ID.values()]
        .filter((announcement) => visibleIn(announcement, citySlug))
        .map((announcement) => {
            const { bodyHtml, ...summary } = announcement[lang]
            return { ...summary, hasBody: bodyHtml !== null }
        })

export const getAnnouncement = (citySlug: string, lang: AnnouncementLanguage, id: string): AnnouncementView => {
    const announcement = ANNOUNCEMENTS_BY_ID.get(id)
    if (!announcement || !visibleIn(announcement, citySlug)) {
        throw new AppError({
            message: 'Announcement not found',
            statusCode: 404,
            internalCode: 'ANNOUNCEMENT_NOT_FOUND',
        })
    }
    return announcement[lang]
}
