import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'citySwitcher';

i18n.addResourceBundle('en', NAMESPACE, {
  city: 'City',
  label: 'Switch city',
});

i18n.addResourceBundle('de', NAMESPACE, {
  city: 'Stadt',
  label: 'Stadt wechseln',
});
