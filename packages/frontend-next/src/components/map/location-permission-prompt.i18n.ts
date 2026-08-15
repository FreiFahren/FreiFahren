import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'locationPermission';

i18n.addResourceBundle('en', NAMESPACE, {
  mapTitle: 'Show your location?',
  mapDescription:
    'See nearby stations faster and help us distinguish trustworthy reports from spam. Your precise location is not shown to others.',
  reportTitle: 'Use your location for this report?',
  reportDescription:
    'Confirming that you are near the selected station helps us filter false reports. Your precise location is not shown to others.',
  allow: 'Use location',
  notNow: 'Not now',
  continueWithout: 'Continue without',
  reportStep: 'Step 1 of 2',
});

i18n.addResourceBundle('de', NAMESPACE, {
  mapTitle: 'Deinen Standort anzeigen?',
  mapDescription:
    'Finde Stationen in der Nähe schneller und hilf uns, vertrauenswürdige Meldungen von Spam zu unterscheiden. Dein genauer Standort wird anderen nicht angezeigt.',
  reportTitle: 'Standort für diese Meldung verwenden?',
  reportDescription:
    'Wenn du bestätigst, dass du in der Nähe der ausgewählten Station bist, können wir Falschmeldungen besser filtern. Dein genauer Standort wird anderen nicht angezeigt.',
  allow: 'Standort verwenden',
  notNow: 'Jetzt nicht',
  continueWithout: 'Ohne fortfahren',
  reportStep: 'Schritt 1 von 2',
});
