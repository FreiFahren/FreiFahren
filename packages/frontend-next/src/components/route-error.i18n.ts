import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'routeError';

i18n.addResourceBundle('en', NAMESPACE, {
  title: 'Something went wrong',
  description: 'This part of the app couldn’t be shown. Trying again reloads its data.',
  retry: 'Try again',
});

i18n.addResourceBundle('de', NAMESPACE, {
  title: 'Etwas ist schiefgelaufen',
  description:
    'Dieser Teil der App konnte nicht angezeigt werden. Erneut versuchen lädt seine Daten neu.',
  retry: 'Erneut versuchen',
});
