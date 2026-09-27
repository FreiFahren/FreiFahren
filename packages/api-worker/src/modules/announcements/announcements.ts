import type { Announcement } from './announcements-types'
import appStoreRemovalDe from './content/app-store-removal/de.md'
import appStoreRemovalEn from './content/app-store-removal/en.md'

/*
 * Source of truth for in-app announcements. Adding one here and deploying the API publishes it;
 * optional Markdown bodies live in content/<id>/<lang>.md.
 */
export const ANNOUNCEMENTS: readonly Announcement[] = [
    {
        id: 'app-store-removal',
        publishedAt: '2026-09-27T12:00:00Z',
        en: {
            title: 'FreiFahren is no longer in the App Store',
            description: "The web app still works, and so does the app if it's already on your phone.",
            body: appStoreRemovalEn,
        },
        de: {
            title: 'FreiFahren ist nicht mehr im App Store',
            description: 'Die Web-App funktioniert weiter, und die App auch, wenn du sie schon hast.',
            body: appStoreRemovalDe,
        },
    },
]
