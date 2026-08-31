import { MapPin } from 'lucide-react';
import { useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import { useCityLocationPrompt } from '@/hooks/use-city-location-prompt';

import { NAMESPACE } from './city-location-prompt.i18n';
import { PopupCard } from './PopupCard';

export function CityLocationPrompt() {
  const { t } = useTranslation(NAMESPACE);
  const { promptCity, showExpansion, accept, decline } = useCityLocationPrompt();
  const [remember, setRemember] = useState(false);

  if (!showExpansion && promptCity === null) return null;

  const title = showExpansion
    ? t('expansionTitle')
    : t('title', { city: promptCity?.displayName });
  const description = showExpansion
    ? t('expansionDescription')
    : t('description', { city: promptCity?.displayName });

  return createPortal(
    <PopupCard>
      <CardContent className="flex flex-col gap-1">
        <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">
          <MapPin className="text-accent-bright size-5" />
          {title}
        </h2>
        <p className="text-muted-foreground text-sm">{description}</p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-3">
        {promptCity !== null && (
          <label className="text-muted-foreground flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={remember}
              onChange={(e) => setRemember(e.target.checked)}
              className="accent-accent-bright size-4 shrink-0 rounded border"
            />
            {t('remember')}
          </label>
        )}
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => decline(remember)}>
            {showExpansion ? t('expansionStay') : t('stay')}
          </Button>
          <Button
            className="bg-accent-bright text-primary-foreground hover:bg-accent-press flex-1"
            onClick={() => accept(remember)}
          >
            {showExpansion ? t('expansionCta') : t('switch')}
          </Button>
        </div>
      </CardFooter>
    </PopupCard>,
    document.body,
  );
}
