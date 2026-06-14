import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'feedback';

i18n.addResourceBundle('en', NAMESPACE, {
  button: 'Send feedback',
  title: 'Send feedback',
  close: 'Close',
  typeLabel: 'What kind of feedback is this?',
  typeFeature: 'Feature request',
  typeBug: 'Bug report',
  typeGeneral: 'General',
  messageLabel: 'Tell us more',
  messagePlaceholder: 'Share your idea, the bug you hit, or anything else…',
  submit: 'Submit',
  submitting: 'Sending…',
  successTitle: 'Thanks for your feedback!',
  successText: 'We read every submission.',
  error: 'Could not send your feedback. Please try again.',
  retry: 'Try again',
});

i18n.addResourceBundle('de', NAMESPACE, {
  button: 'Feedback geben',
  title: 'Feedback geben',
  close: 'Schließen',
  typeLabel: 'Worum geht es?',
  typeFeature: 'Feature-Wunsch',
  typeBug: 'Fehler melden',
  typeGeneral: 'Allgemein',
  messageLabel: 'Erzähl uns mehr',
  messagePlaceholder: 'Teile deine Idee, den gefundenen Fehler oder alles andere…',
  submit: 'Absenden',
  submitting: 'Wird gesendet…',
  successTitle: 'Danke für dein Feedback!',
  successText: 'Wir lesen jede Rückmeldung.',
  error: 'Feedback konnte nicht gesendet werden. Bitte versuche es erneut.',
  retry: 'Erneut versuchen',
});
