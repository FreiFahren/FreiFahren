import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'linePicker';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Which line?',
  description: 'Several lines run here.',
  circular: 'Circular line',
  close: 'Close',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Welche Linie?',
  description: 'Hier fahren mehrere Linien.',
  circular: 'Ringlinie',
  close: 'Schließen',
});
