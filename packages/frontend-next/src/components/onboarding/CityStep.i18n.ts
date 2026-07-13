import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'cityStep';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Choose your city',
  text: 'FreiFahren shows community reports for one city at a time.',
  hint: 'You can change this anytime in the settings.',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Wählen Sie Ihre Stadt',
  text: 'FreiFahren zeigt Community-Meldungen für jeweils eine Stadt.',
  hint: 'Sie können die Stadt jederzeit in den Einstellungen ändern.',
});
