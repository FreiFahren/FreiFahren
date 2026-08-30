import { ChevronDown, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { currentCity, navigateToCity } from '@/lib/city';
import { selectableCities, useCitySwitchingEnabled } from '@/lib/city-switching';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { NAMESPACE } from './CitySwitcher.i18n';

export function CitySwitcher() {
  const enabled = useCitySwitchingEnabled();
  const { t } = useTranslation(NAMESPACE);

  if (!enabled) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('label')}
        className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors outline-none"
      >
        <MapPin className="text-muted-foreground size-4" />
        <span>{t('city')}</span>
        <span className="text-muted-foreground ml-auto flex items-center gap-1">
          {currentCity.displayName}
          <ChevronDown className="size-4" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={currentCity.slug}
          onValueChange={(slug) => {
            if (slug === currentCity.slug) return;
            const city = selectableCities.find((c) => c.slug === slug);
            if (!city) return;
            navigateToCity(city, { resetAutoSwitch: true });
          }}
        >
          {selectableCities.map((city) => (
            <DropdownMenuRadioItem key={city.slug} value={city.slug}>
              {city.displayName}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
