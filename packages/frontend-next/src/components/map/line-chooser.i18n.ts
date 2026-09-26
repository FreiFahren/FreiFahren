import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'lineChooser';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Which line?',
  description: 'Several lines run here. Choose one to explore.',
  close: 'Close line choices',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Welche Linie?',
  description: 'Hier fahren mehrere Linien. Wähle eine aus.',
  close: 'Linienauswahl schließen',
});
