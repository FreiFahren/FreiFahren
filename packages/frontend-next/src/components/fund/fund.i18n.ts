import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'fund';

i18n.addResourceBundle('en', NAMESPACE, {
  open: 'Open Fund',
  title: 'FreiFahren Fund',
  intro: 'Your uploads and contributions.',
  headline: 'Got a fine? Upload it, the Fund pays it.',
  photoTitle: 'Snap a photo of your fine',
  paymentTitle: 'We take care of the payment',
  freeTitle: 'Keep FreiFahren free',
  signInTitle: 'Sign in to continue',
});

i18n.addResourceBundle('de', NAMESPACE, {
  open: 'Solidaritätsfonds öffnen',
  title: 'FreiFahren Fund',
  intro: 'Deine Uploads und Beiträge.',
  headline: 'Knölchen bekommen? Lade es hoch, der Fund zahlt.',
  photoTitle: 'Fotografiere dein Knölchen',
  paymentTitle: 'Wir kümmern uns um die Zahlung',
  freeTitle: 'Halte FreiFahren kostenlos',
  signInTitle: 'Zum Fortfahren anmelden',
});
