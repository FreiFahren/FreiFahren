import { ChevronDown, Languages } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import {
  SUPPORTED_LANGUAGES,
  setLanguagePreference,
  useLanguagePreference,
  type LanguagePreference,
} from '@/lib/language';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

import { NAMESPACE } from './LanguageSwitcher.i18n';

const OPTIONS: LanguagePreference[] = ['auto', ...SUPPORTED_LANGUAGES];

// A row in the settings card (matches CitySwitcher): the current choice on the right, tapping it
// opens a menu to switch. "Auto" follows the device/browser locale (see lib/language.ts); picking
// a language explicitly overrides it until switched back to "Auto".
export function LanguageSwitcher() {
  const preference = useLanguagePreference();
  const { t } = useTranslation(NAMESPACE);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t('label')}
        className="hover:bg-muted focus-visible:bg-muted flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors outline-none"
      >
        <Languages className="text-muted-foreground size-4" />
        <span>{t('language')}</span>
        <span className="text-muted-foreground ml-auto flex items-center gap-1">
          {t(preference)}
          <ChevronDown className="size-4" />
        </span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuRadioGroup
          value={preference}
          onValueChange={(value) => setLanguagePreference(value as LanguagePreference)}
        >
          {OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option} value={option}>
              {t(option)}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
