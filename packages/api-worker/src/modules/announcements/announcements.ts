import type { Announcement } from './announcements-types'

// Source of truth for in-app announcements. Adding one here and deploying the API publishes it.
export const ANNOUNCEMENTS: readonly Announcement[] = [
    {
        id: 'announcements-launch',
        publishedAt: '2026-09-24T10:00:00Z',
        en: {
            title: 'Introducing announcements',
            description: 'News about FreiFahren now shows up right here in the app.',
            bodyHtml: `
<p>From now on, we'll post updates about FreiFahren here — new cities, new features and anything else you should know.</p>
<h2>What you'll find here</h2>
<ul>
    <li><strong>New features</strong> as soon as they ship</li>
    <li><strong>New cities</strong> when FreiFahren expands</li>
    <li><strong>Important notices</strong> about the app</li>
</ul>
<p>Tap the bell on the map to catch up at any time. Have feedback? You can reach us from the settings menu.</p>
`,
        },
        de: {
            title: 'Neu: Ankündigungen',
            description: 'Neuigkeiten zu FreiFahren findest du ab jetzt direkt hier in der App.',
            bodyHtml: `
<p>Ab sofort informieren wir dich hier über Neuigkeiten zu FreiFahren — neue Städte, neue Funktionen und alles, was du sonst wissen solltest.</p>
<h2>Was dich hier erwartet</h2>
<ul>
    <li><strong>Neue Funktionen</strong>, sobald sie verfügbar sind</li>
    <li><strong>Neue Städte</strong>, wenn FreiFahren wächst</li>
    <li><strong>Wichtige Hinweise</strong> zur App</li>
</ul>
<p>Tippe jederzeit auf die Glocke auf der Karte, um auf dem Laufenden zu bleiben. Feedback? Du erreichst uns über das Einstellungsmenü.</p>
`,
        },
    },
]
