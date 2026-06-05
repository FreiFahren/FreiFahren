import { useTranslation } from 'react-i18next';

import { CardContent } from '@/components/ui/card';

import { DetailCard } from './DetailCard';
import { NAMESPACE } from './SettingsButton.i18n';

type SettingsCardProps = {
  onClose: () => void;
};

export function SettingsCard({ onClose }: SettingsCardProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <DetailCard title={t('title')} closeLabel={t('close')} onClose={onClose}>
      <CardContent className="text-muted-foreground text-sm">{t('placeholder')}</CardContent>
    </DetailCard>
  );
}
