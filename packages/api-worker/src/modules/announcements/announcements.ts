import type { Announcement } from './announcements-types'

// Source of truth for in-app announcements. Adding one here and deploying the API publishes it.
export const ANNOUNCEMENTS: readonly Announcement[] = [
    {
        id: 'announcements-launch',
        publishedAt: '2026-09-24T10:00:00Z',
        en: {
            title: 'Introducing announcements',
            description: 'News about FreiFahren now shows up right here in the app.',
            body: `
From now on, we'll post updates about FreiFahren here — new cities, new features and anything else you should know.

## What you'll find here

- **New features** as soon as they ship
- **New cities** when FreiFahren expands
- **Important notices** about the app

Tap the bell on the map to catch up at any time. Have feedback? You can reach us from the settings menu.
`,
        },
        de: {
            title: 'Neu: Ankündigungen',
            description: 'Neuigkeiten zu FreiFahren findest du ab jetzt direkt hier in der App.',
            body: `
Ab sofort informieren wir dich hier über Neuigkeiten zu FreiFahren — neue Städte, neue Funktionen und alles, was du sonst wissen solltest.

## Was dich hier erwartet

- **Neue Funktionen**, sobald sie verfügbar sind
- **Neue Städte**, wenn FreiFahren wächst
- **Wichtige Hinweise** zur App

Tippe jederzeit auf die Glocke auf der Karte, um auf dem Laufenden zu bleiben. Feedback? Du erreichst uns über das Einstellungsmenü.
`,
        },
    },
]
