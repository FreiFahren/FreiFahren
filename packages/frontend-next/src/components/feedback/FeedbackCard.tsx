import { useRouterState } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/map/DetailCard';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { captureSurveySent, type FeedbackType } from '@/lib/analytics';
import { closeFeedbackModal, FEEDBACK_SURVEY_ID, useFeedbackModalOpen } from '@/lib/feedback-modal';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './FeedbackCard.i18n';

export function FeedbackCard() {
  const open = useFeedbackModalOpen();
  // Remount on each open (key) so the form state resets and the same user can submit repeatedly.
  if (!open) return null;
  return <FeedbackCardContent />;
}

const TYPE_OPTIONS: { value: FeedbackType; labelKey: string }[] = [
  { value: 'feature_request', labelKey: 'typeFeature' },
  { value: 'bug_report', labelKey: 'typeBug' },
  { value: 'general', labelKey: 'typeGeneral' },
];

function FeedbackCardContent() {
  const { t } = useTranslation(NAMESPACE);
  const pageRoute = useRouterState({ select: (s) => s.location.pathname });

  const [feedbackType, setFeedbackType] = useState<FeedbackType>('feature_request');
  const [message, setMessage] = useState('');
  const [status, setStatus] = useState<'editing' | 'sending' | 'done' | 'error'>('editing');

  const handleSubmit = () => {
    const trimmed = message.trim();
    if (!trimmed) return;
    setStatus('sending');
    try {
      captureSurveySent(FEEDBACK_SURVEY_ID, {
        feedbackType,
        message: trimmed,
        pageRoute,
        appVersion: __BUILD_ID__,
      });
      setStatus('done');
      // Brief success confirmation, then dismiss.
      window.setTimeout(closeFeedbackModal, 1200);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <DetailCard title={t('title')} closeLabel={t('close')} onClose={closeFeedbackModal}>
        <CardContent className="flex flex-col items-center gap-3 py-6 text-center">
          <div className="bg-accent-bright text-primary-foreground animate-in zoom-in-50 fade-in flex size-14 items-center justify-center rounded-full duration-300">
            <Check className="size-7" />
          </div>
          <h3 className="font-heading text-lg font-semibold">{t('successTitle')}</h3>
          <p className="text-muted-foreground text-sm">{t('successText')}</p>
        </CardContent>
      </DetailCard>
    );
  }

  const sending = status === 'sending';
  const canSubmit = message.trim().length > 0 && !sending;

  return (
    <DetailCard title={t('title')} closeLabel={t('close')} onClose={closeFeedbackModal}>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <span className="text-sm font-semibold">{t('typeLabel')}</span>
          <ToggleGroup
            type="single"
            variant="outline"
            value={feedbackType}
            // Radix clears the value when re-selecting the active item; keep a selection always.
            onValueChange={(value) => value && setFeedbackType(value as FeedbackType)}
            className="grid w-full grid-cols-3"
          >
            {TYPE_OPTIONS.map((option) => (
              <ToggleGroupItem key={option.value} value={option.value} className="text-xs">
                {t(option.labelKey)}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        </div>

        <div className="flex flex-col gap-2">
          <label htmlFor="feedback-message" className="text-sm font-semibold">
            {t('messageLabel')}
          </label>
          <textarea
            id="feedback-message"
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder={t('messagePlaceholder')}
            rows={4}
            className="border-input bg-input/20 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 dark:bg-input/30 min-h-24 w-full resize-none rounded-md border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50"
          />
        </div>

        {status === 'error' && <p className="text-destructive text-sm">{t('error')}</p>}

        <Button
          type="button"
          size="lg"
          disabled={!canSubmit}
          onClick={handleSubmit}
          className={cn(
            'h-11 w-full gap-2',
            canSubmit
              ? 'bg-accent-bright text-primary-foreground hover:bg-accent-press'
              : 'bg-surface-solid text-muted-foreground border-border border',
          )}
        >
          {sending ? t('submitting') : status === 'error' ? t('retry') : t('submit')}
        </Button>
      </CardContent>
    </DetailCard>
  );
}
