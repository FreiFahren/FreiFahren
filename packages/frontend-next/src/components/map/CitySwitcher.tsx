import { Capacitor } from '@capacitor/core';
import { ChevronDown, MapPin } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { currentCity, setCityPreference } from '@/lib/city';
import { selectableCities, useCitySwitchingEnabled } from '@/lib/city-switching';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { NAMESPACE } from './CitySwitcher.i18n';

// Web resolves the city from the hostname at boot (see lib/city.ts), so switching means navigating
// to the target subdomain: swap the leftmost label and keep the rest (app.freifahren.org ->
// berlin.freifahren.org). Native has no subdomain (capacitor://localhost) and resolves from a
// stored preference instead, so it switches via setCityPreference (see the handler below).
function urlForSubdomain(subdomain: string): string {
  const { protocol, hostname, port, pathname, search } = window.location;
  const labels = hostname.split('.');
  const host = labels.length < 2 ? hostname : [subdomain, ...labels.slice(1)].join('.');
  return `${protocol}//${host}${port ? `:${port}` : ''}${pathname}${search}`;
}

// A row in the settings card (matches the Contact/Feedback rows): the current city on the right,
// tapping it opens a menu to switch. Lives in settings rather than on the map because switching is
// rare — but the row makes it discoverable that more than one city exists.
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
            if (Capacitor.isNativePlatform()) {
              setCityPreference(city.slug);
            } else {
              window.location.assign(urlForSubdomain(city.subdomain));
            }
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
