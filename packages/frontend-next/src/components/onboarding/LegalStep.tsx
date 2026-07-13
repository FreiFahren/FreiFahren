import { useTranslation } from 'react-i18next';

import { LegalDisclaimerPoints, LegalLinks } from '@/components/LegalDisclaimer';
import { NAMESPACE } from '@/components/LegalDisclaimer.i18n';
import { Button } from '@/components/ui/button';
import {
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { acceptLegalDisclaimer } from '@/lib/legal-disclaimer';

// The explicitly labeled accept button (clickwrap) is what makes the acceptance legally
// meaningful — never replace it with a bare "Continue".
export function LegalStep() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <>
      <CardHeader>
        <CardTitle id="onboarding-step-title" className="font-heading text-lg font-semibold">
          {t('title')}
        </CardTitle>
        <CardDescription className="text-sm">{t('text')}</CardDescription>
      </CardHeader>
      <CardContent className="min-h-0 flex-1 overflow-y-auto">
        <LegalDisclaimerPoints />
        <p className="text-muted-foreground mt-4 text-xs">{t('saved')}</p>
      </CardContent>
      <CardFooter className="flex-col items-stretch gap-2">
        <Button
          size="lg"
          onClick={acceptLegalDisclaimer}
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press"
        >
          {t('confirm')}
        </Button>
        <LegalLinks className="self-end" />
      </CardFooter>
    </>
  );
}
