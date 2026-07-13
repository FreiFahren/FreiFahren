import { ChevronRight, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { setCityPreference } from '@/lib/city';
import { selectableCities } from '@/lib/city-switching';

import { NAMESPACE } from './CityStep.i18n';

export function CityStep() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <>
      <CardHeader>
        <CardTitle id="onboarding-step-title" className="font-heading text-lg font-semibold">
          {t('title')}
        </CardTitle>
        <CardDescription className="text-sm">{t('text')}</CardDescription>
      </CardHeader>
      <CardContent className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
        {selectableCities.map((city) => (
          <Button
            key={city.slug}
            variant="outline"
            onClick={() => setCityPreference(city.slug)}
            className="h-auto w-full justify-start gap-3 rounded-lg px-4 py-3 text-sm font-medium"
          >
            <MapPin className="text-muted-foreground size-4" />
            {city.displayName}
            <ChevronRight className="text-muted-foreground ml-auto size-4" />
          </Button>
        ))}
        <p className="text-muted-foreground mt-auto pt-2 text-xs">{t('hint')}</p>
      </CardContent>
    </>
  );
}
