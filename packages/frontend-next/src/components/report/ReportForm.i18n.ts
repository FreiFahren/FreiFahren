import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'reportSighting';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Report sighting',
  back: 'Back',
  line: 'Line',
  optional: 'Optional',
  all: 'All',
  subway: 'U-Bahn',
  light_rail: 'S-Bahn',
  tram: 'Tram',
  station: 'Station',
  required: 'Required',
  searchStation: 'Search station…',
  nearby: 'Nearby',
  noMatch: 'No stations match “{{query}}”.',
  clearSelection: 'clear selection',
  direction: 'Direction',
  submit: 'Submit report',
  reportLocationStep: 'Step 2 of 2 · Select report location',
  disclaimer: 'Shared anonymously with all Freifahren users.',
  errorTooSoon: 'You reported very recently. Please wait a moment.',
  errorTooFar: "You're not close enough to the station.",
  errorSubmitFailed: 'Report could not be sent. Please try again.',
  submitFailedTitle: "Reports aren't going through",
  submitFailedBody:
    "Something's blocking your reports right now. It may clear up on its own, but you can report sightings in the Telegram group instead, and they'll show up here as usual.",
  disabledTitle: 'Reporting is currently off',
  disabledBody:
    "Reporting in the app is paused for now. You can still report sightings in the Telegram group, and they'll show up here as usual.",
  disabledTelegramCta: 'Open Telegram group',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Sichtung melden',
  back: 'Zurück',
  line: 'Linie',
  optional: 'Optional',
  all: 'Alle',
  subway: 'U-Bahn',
  light_rail: 'S-Bahn',
  tram: 'Tram',
  station: 'Station',
  required: 'Erforderlich',
  searchStation: 'Station suchen…',
  nearby: 'In der Nähe',
  noMatch: 'Keine Station passt zu „{{query}}“.',
  clearSelection: 'Auswahl löschen',
  direction: 'Richtung',
  submit: 'Melden',
  reportLocationStep: 'Schritt 2 von 2 · Ort der Meldung auswählen',
  disclaimer: 'Anonym an alle Freifahren-Nutzer geteilt.',
  errorTooSoon: 'Du hast gerade erst gemeldet. Bitte warte einen Moment.',
  errorTooFar: 'Du bist nicht nah genug an der Station.',
  errorSubmitFailed: 'Meldung konnte nicht gesendet werden. Bitte versuche es erneut.',
  submitFailedTitle: 'Melden klappt gerade nicht',
  submitFailedBody:
    'Deine Meldungen kommen momentan nicht durch. Das kann sich von selbst wieder lösen, du kannst Sichtungen aber auch stattdessen in der Telegram-Gruppe melden, sie werden wie gewohnt hier angezeigt.',
  disabledTitle: 'Melden ist aktuell aus',
  disabledBody:
    'Melden in der App ist vorübergehend pausiert. In der Telegram-Gruppe kannst du weiterhin Sichtungen melden, sie werden wie gewohnt hier angezeigt.',
  disabledTelegramCta: 'Telegram-Gruppe öffnen',
});
