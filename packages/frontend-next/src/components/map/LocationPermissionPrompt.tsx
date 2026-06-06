import { MapPin } from 'lucide-react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';

import { NAMESPACE } from './LocationPermissionPrompt.i18n';
import { PopupCard } from './PopupCard';

type LocationPermissionPromptProps = {
  onAllow: () => void;
  onDismiss: () => void;
};

export function LocationPermissionPrompt({ onAllow, onDismiss }: LocationPermissionPromptProps) {
  const { t } = useTranslation(NAMESPACE);

  return createPortal(
    <PopupCard>
      <CardContent className="flex flex-col gap-1">
        <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
          <MapPin className="text-accent-bright size-5" />
          {t('title')}
        </h2>
        <p className="text-muted-foreground text-sm">{t('description')}</p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1" onClick={onDismiss}>
          {t('notNow')}
        </Button>
        <Button
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press flex-1"
          onClick={onAllow}
        >
          {t('allow')}
        </Button>
      </CardFooter>
    </PopupCard>,
    document.body,
  );
}
