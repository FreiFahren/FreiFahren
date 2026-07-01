import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/map/DetailCard';
import { CardContent } from '@/components/ui/card';
import { closeFeedbackModal, useFeedbackModalOpen } from '@/lib/feedback-modal';

import { FeedbackForm } from './FeedbackForm';
import { NAMESPACE } from './FeedbackCard.i18n';

export function FeedbackCard() {
  const open = useFeedbackModalOpen();
  // Remount on each open (key) so the form state resets and the same user can submit repeatedly.
  if (!open) return null;
  return <FeedbackCardContent />;
}

function FeedbackCardContent() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <DetailCard title={t('title')} closeLabel={t('close')} onClose={closeFeedbackModal}>
      <CardContent>
        {/* Brief success confirmation, then dismiss. */}
        <FeedbackForm onSubmitted={() => window.setTimeout(closeFeedbackModal, 1200)} />
      </CardContent>
    </DetailCard>
  );
}
