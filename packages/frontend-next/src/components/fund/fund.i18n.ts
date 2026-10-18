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
  loadFailed: 'Your membership couldn’t be loaded. Please try again.',
  priceTitle: 'Pay what you think is fair',
  amountBody:
    'All contributions together pay the members’ fines. From {{amount}} a month you’re in; whoever can give more carries those who have less.',
  amountField: 'Monthly contribution',
  perMonth: 'a month',
  join: 'Continue to payment',
  joinHint:
    'You pay with Stripe and can cancel any time. Enter your name exactly as on your ID there: fines are issued to it.',
  pendingTitle: 'Your signup isn’t finished',
  pendingBody:
    'We haven’t received your first payment yet. If you just paid, this updates in a moment.',
  canceledTitle: 'You’re not protected',
  canceledBody:
    'Your membership has ended, so new fines aren’t covered. You can join again whenever you like.',
  statusProtected: 'You’re protected',
  statusEnding: 'Protected until {{date}}',
  statusEndingBody:
    'Your membership won’t renew. Fines after that date aren’t covered unless you resume it.',
  statusPastDue: 'Payment overdue',
  memberPastDueBody:
    'Your last contribution couldn’t be collected. Update your payment method so your membership keeps running.',
  contribution: '{{amount}} a month',
  renewsOn: 'Renews on {{date}}',
  rulesTitle: 'What you need to know',
  ruleDontPayTitle: 'Don’t pay the fine yourself',
  ruleDontPayBody:
    'Submit it to the Fund and wait for us. We can’t refund anything you’ve already paid yourself.',
  ruleNoTicketTitle: 'The Fund doesn’t replace a ticket',
  ruleNoTicketBody:
    'It’s a solidarity community for when it happens, not a ticket. There is no legal entitlement to a payout.',
  ruleRepeatTitle: 'Repeatedly riding without a ticket can be a crime',
  ruleRepeatBody:
    'Getting caught without a ticket again and again can lead to criminal charges for fare evasion (§ 265a StGB).',
  manage: 'Manage membership',
  stripeFailed: 'Stripe couldn’t be opened. Please try again.',
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
  loadFailed: 'Deine Mitgliedschaft konnte nicht geladen werden. Bitte versuche es erneut.',
  priceTitle: 'Zahl, was du fair findest',
  amountBody:
    'Aus allen Beiträgen bezahlt der Fonds die Bußgelder seiner Mitglieder. Ab {{amount}} im Monat bist du dabei. Wer mehr geben kann, trägt die mit, die weniger haben.',
  amountField: 'Monatlicher Beitrag',
  perMonth: 'im Monat',
  join: 'Weiter zur Zahlung',
  joinHint:
    'Du zahlst über Stripe und kannst jederzeit kündigen. Gib dort deinen Namen genau wie im Ausweis an: Bußgelder werden auf ihn ausgestellt.',
  pendingTitle: 'Dein Beitritt ist noch nicht abgeschlossen',
  pendingBody:
    'Deine erste Zahlung ist noch nicht bei uns. Wenn du gerade bezahlt hast, aktualisiert sich das gleich.',
  canceledTitle: 'Du bist nicht abgesichert',
  canceledBody:
    'Deine Mitgliedschaft ist beendet, neue Bußgelder sind nicht mehr gedeckt. Du kannst jederzeit wieder beitreten.',
  statusProtected: 'Du bist abgesichert',
  statusEnding: 'Abgesichert bis {{date}}',
  statusEndingBody:
    'Deine Mitgliedschaft verlängert sich nicht. Bußgelder nach diesem Datum sind nicht gedeckt, außer du setzt sie fort.',
  statusPastDue: 'Zahlung überfällig',
  memberPastDueBody:
    'Dein letzter Beitrag konnte nicht eingezogen werden. Aktualisiere deine Zahlungsart, damit deine Mitgliedschaft weiterläuft.',
  contribution: '{{amount}} im Monat',
  renewsOn: 'Verlängert sich am {{date}}',
  rulesTitle: 'Was du wissen musst',
  ruleDontPayTitle: 'Zahl das Bußgeld nicht selbst',
  ruleDontPayBody:
    'Reich es beim Fonds ein und warte auf uns. Was du schon selbst bezahlt hast, können wir nicht erstatten.',
  ruleNoTicketTitle: 'Der Fonds ersetzt kein Ticket',
  ruleNoTicketBody:
    'Er ist eine Solidargemeinschaft für den Fall der Fälle, kein Fahrschein. Ein Rechtsanspruch auf Übernahme besteht nicht.',
  ruleRepeatTitle: 'Wiederholtes Fahren ohne Ticket kann strafbar sein',
  ruleRepeatBody:
    'Wer mehrfach ohne Fahrschein erwischt wird, riskiert eine Anzeige wegen Erschleichens von Leistungen (§ 265a StGB).',
  manage: 'Mitgliedschaft verwalten',
  stripeFailed: 'Stripe konnte nicht geöffnet werden. Bitte versuche es erneut.',
});
