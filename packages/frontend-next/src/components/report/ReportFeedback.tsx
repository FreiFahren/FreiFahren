import { ThumbsDown, ThumbsUp } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FeedbackForm } from '@/components/feedback/FeedbackForm';
import { Button } from '@/components/ui/button';
import { captureSurveyShown, type FeedbackSentiment, track } from '@/lib/analytics';
import { FEEDBACK_SURVEY_ID } from '@/lib/feedback-modal';

import { NAMESPACE } from './ReportSuccess.i18n';

// Two-tier feedback: a single 👍/👎 tap, expanding to the full comment form only once opted in.
export function ReportFeedback({ onDone }: { onDone?: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  const [sentiment, setSentiment] = useState<FeedbackSentiment | null>(null);

  useEffect(() => {
    captureSurveyShown(FEEDBACK_SURVEY_ID);
  }, []);

  const choose = (value: FeedbackSentiment) => {
    setSentiment(value);
    // Capture on the tap so we get sentiment even from users who don't elaborate.
    track('feedback_sentiment_selected', { sentiment: value });
  };

  if (!sentiment) {
    return (
      <div className="flex flex-col items-center gap-3">
        <span className="text-muted-foreground text-sm">{t('sentimentPrompt')}</span>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            onClick={() => choose('positive')}
            aria-label={t('sentimentYes')}
            className="border-border size-12 rounded-full"
          >
            <ThumbsUp className="size-5" />
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => choose('negative')}
            aria-label={t('sentimentNo')}
            className="border-border size-12 rounded-full"
          >
            <ThumbsDown className="size-5" />
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in slide-in-from-top-1 flex flex-col text-left duration-200">
      <FeedbackForm
        compact
        submitVariant="neutral"
        sentiment={sentiment}
        onSubmitted={onDone ? () => window.setTimeout(onDone, 1200) : undefined}
      />
    </div>
  );
}
