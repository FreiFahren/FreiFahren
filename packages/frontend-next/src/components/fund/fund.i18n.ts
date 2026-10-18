import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'fund';

i18n.addResourceBundle('en', NAMESPACE, {
  open: 'Open Fund',
  title: 'FreiFahren Fund',
  intro: 'Your uploads.',
  headline: 'Got a fine? Upload it, the Fund pays it.',
  photoTitle: 'Snap a photo of your fine',
  paymentTitle: 'We take care of the payment',
  freeTitle: 'Keep FreiFahren free',
  signInTitle: 'Sign in to continue',
  uploadsTitle: 'Your uploads',
  uploadedAt: 'Uploaded',
  status: 'Status',
  fineStatus: { in_review: 'In review', paid: 'Paid by the Fund', declined: 'Declined' },
  emptyUploads: 'You have not uploaded any fines yet. Your submissions will appear here.',
  loadingHistory: 'Loading your history…',
  historyError: 'Your history could not be loaded. Please try again.',
  retry: 'Try again',
});

i18n.addResourceBundle('de', NAMESPACE, {
  open: 'Solidaritätsfonds öffnen',
  title: 'FreiFahren Fonds',
  intro: 'Deine Uploads.',
  headline: 'Knöllchen bekommen? Lade es hoch, der Fonds zahlt.',
  photoTitle: 'Fotografiere dein Knölchen',
  paymentTitle: 'Wir kümmern uns um die Zahlung',
  freeTitle: 'Halte FreiFahren kostenlos',
  signInTitle: 'Zum Fortfahren anmelden',
  uploadsTitle: 'Deine Uploads',
  uploadedAt: 'Hochgeladen',
  status: 'Status',
  fineStatus: { in_review: 'In Prüfung', paid: 'Vom Fonds bezahlt', declined: 'Abgelehnt' },
  emptyUploads: 'Du hast noch keine Knöllchen hochgeladen. Deine Einreichungen erscheinen hier.',
  loadingHistory: 'Dein Verlauf wird geladen…',
  historyError: 'Dein Verlauf konnte nicht geladen werden. Bitte versuche es erneut.',
  retry: 'Erneut versuchen',
});
