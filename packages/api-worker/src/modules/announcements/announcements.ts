import type { Announcement } from './announcements-types'
import launchDe from './content/announcements-launch/de.md'
import launchEn from './content/announcements-launch/en.md'

/*
 * Source of truth for in-app announcements. Adding one here and deploying the API publishes it;
 * optional Markdown bodies live in content/<id>/<lang>.md.
 */
export const ANNOUNCEMENTS: readonly Announcement[] = [
    {
        id: 'announcements-launch',
        publishedAt: '2026-09-24T10:00:00Z',
        en: {
            title: 'Introducing announcements',
            description: 'News about FreiFahren now shows up right here in the app.',
            body: launchEn,
        },
        de: {
            title: 'Neu: Ankündigungen',
            description: 'Neuigkeiten zu FreiFahren findest du ab jetzt direkt hier in der App.',
            body: launchDe,
        },
    },
]
