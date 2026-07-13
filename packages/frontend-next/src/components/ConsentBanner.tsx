import { Link } from '@tanstack/react-router';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import { PopupCard } from '@/components/map/PopupCard';
import { Button } from '@/components/ui/button';
import { CardContent, CardFooter } from '@/components/ui/card';
import {
  closeConsentSettings,
  setConsent,
  syncConsentToPostHog,
  useConsentPrompt,
  useConsentReview,
} from '@/lib/consent';
import { useOnboardingComplete } from '@/lib/onboarding';
import { optionalEnv } from '@/lib/utils';
import { Route as PrivacyRoute } from '@/routes/privacy';

import { NAMESPACE } from './ConsentBanner.i18n';

// Only meaningful when PostHog is actually enabled; without a key there is nothing to consent to.
const analyticsEnabled = optionalEnv('VITE_POSTHOG_KEY') != null;

/**
 * Non-blocking bottom prompt for analytics. Shown until the user decides, and reopenable from
 * settings to change the choice. Uses the same PopupCard wrapper as the location permission prompt;
 * "Decline" is given equal weight to "Accept" so the choice is genuinely free. The first-run prompt
 * waits until onboarding is done so the prompts never stack.
 */
export function ConsentBanner() {
  const { t } = useTranslation(NAMESPACE);
  const showPrompt = useConsentPrompt();
  const reviewOpen = useConsentReview();
  const onboarded = useOnboardingComplete();

  // Reapply a returning visitor's stored choice once the SDK has initialized.
  useEffect(() => {
    if (analyticsEnabled) syncConsentToPostHog();
  }, []);

  if (!analyticsEnabled) return null;
  // Reopened from settings always shows; the first-run/expired prompt stays until the user
  // (re-)decides.
  if (!reviewOpen && (!showPrompt || !onboarded)) return null;

  return createPortal(
    <PopupCard>
      <CardContent className="flex flex-col gap-1">
        <h2 className="font-heading flex items-center gap-2 text-lg font-semibold">{t('title')}</h2>
        <p className="text-muted-foreground text-sm">{t('text')}</p>
        <Link
          to={PrivacyRoute.to}
          preload={false}
          onClick={reviewOpen ? closeConsentSettings : undefined}
          className="text-muted-foreground hover:text-foreground mt-1 inline-block text-xs underline"
        >
          {t('privacy')}
        </Link>
      </CardContent>
      <CardFooter className="gap-2">
        <Button variant="outline" className="flex-1" onClick={() => setConsent('denied')}>
          {t('decline')}
        </Button>
        <Button
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press flex-1"
          onClick={() => setConsent('granted')}
        >
          {t('accept')}
        </Button>
      </CardFooter>
    </PopupCard>,
    document.body,
  );
}
