import { MessageSquarePlus } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { openFeedbackModal, type FeedbackSource } from '@/lib/feedback-modal';

import { NAMESPACE } from './FeedbackCard.i18n';

type FeedbackButtonProps = Omit<React.ComponentProps<typeof Button>, 'onClick'> & {
  source: FeedbackSource;
};

export function FeedbackButton({
  source,
  variant = 'ghost',
  size = 'sm',
  className,
  children,
  ...props
}: FeedbackButtonProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={() => openFeedbackModal(source)}
      // Default label keeps icon-only usages (header buttons) accessible; callers can override.
      aria-label={t('button')}
      className={className}
      {...props}
    >
      {children ?? (
        <>
          <MessageSquarePlus />
          {t('button')}
        </>
      )}
    </Button>
  );
}
