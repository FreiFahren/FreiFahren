import { useRouterState } from '@tanstack/react-router';
import { Check } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { captureSurveySent, type FeedbackSentiment, type FeedbackType } from '@/lib/analytics';
import { FEEDBACK_SURVEY_ID } from '@/lib/feedback-modal';
import { cn } from '@/lib/utils';

import { NAMESPACE } from './FeedbackCard.i18n';

const TYPE_OPTIONS: { value: FeedbackType; labelKey: string }[] = [
  { value: 'feature_request', labelKey: 'typeFeature' },
  { value: 'bug_report', labelKey: 'typeBug' },
  { value: 'general', labelKey: 'typeGeneral' },
];

// The feedback form body, shared by the modal (FeedbackCard) and the embedded report-success screen.
export function FeedbackForm({
  onSubmitted,
  compact = false,
  sentiment,
  submitVariant = 'accent',
}: {
  onSubmitted?: () => void;
  compact?: boolean;
  sentiment?: FeedbackSentiment;
  submitVariant?: 'accent' | 'neutral';
}) {
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
        sentiment,
      });
      setStatus('done');
      onSubmitted?.();
    } catch {
      setStatus('error');
    }
  };

  if (status === 'done') {
    return (
      <div className="flex flex-col items-center gap-3 py-6 text-center">
        <div className="bg-accent-bright text-primary-foreground animate-in zoom-in-50 fade-in flex size-14 items-center justify-center rounded-full duration-300">
          <Check className="size-7" />
        </div>
        <h3 className="font-heading text-lg font-semibold">{t('successTitle')}</h3>
        <p className="text-muted-foreground text-sm">{t('successText')}</p>
      </div>
    );
  }

  const sending = status === 'sending';
  const canSubmit = message.trim().length > 0 && !sending;

  return (
    <div className={cn('flex flex-col', compact ? 'gap-2.5' : 'gap-4')}>
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
          rows={compact ? 2 : 4}
          className={cn(
            'border-input bg-input/20 placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-ring/30 dark:bg-input/30 w-full resize-none rounded-md border px-3 py-2 text-sm transition-colors outline-none focus-visible:ring-2 disabled:pointer-events-none disabled:opacity-50',
            compact ? 'min-h-16' : 'min-h-24',
          )}
        />
      </div>

      {status === 'error' && <p className="text-destructive text-sm">{t('error')}</p>}

      <Button
        type="button"
        size="lg"
        disabled={!canSubmit}
        onClick={handleSubmit}
        className={cn(
          'w-full gap-2',
          compact ? 'h-10' : 'h-11',
          canSubmit &&
            submitVariant === 'accent' &&
            'bg-accent-bright text-primary-foreground hover:bg-accent-press',
          canSubmit &&
            submitVariant === 'neutral' &&
            'bg-foreground text-background hover:bg-foreground/90',
          !canSubmit && 'bg-surface-solid text-muted-foreground border-border border',
        )}
      >
        {sending ? t('submitting') : status === 'error' ? t('retry') : t('submit')}
      </Button>
    </div>
  );
}
