import { useEffect, useRef, useState } from 'react';

import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import {
  getAutoSwitchCityPreference,
  setAutoSwitchCityPreference,
  type AutoSwitchCityPreference,
} from '@/lib/auto-switch-city';
import { currentCitySlug, navigateToCity } from '@/lib/city';
import { cityForPosition } from '@/lib/city-for-position';
import { selectableCities, useCitySwitchingEnabled } from '@/lib/city-switching';
import { useConsentPrompt, useConsentReview } from '@/lib/consent';
import { useContributeModalOpen } from '@/lib/contribute-modal';
import { useActiveLocationPrompt } from '@/lib/location-prompt';
import { useOnboardingComplete } from '@/lib/onboarding';
import { optionalEnv } from '@/lib/utils';

const MAX_ACCURACY_METERS = 25_000;
const analyticsEnabled = optionalEnv('VITE_POSTHOG_KEY') != null;

export function useCityLocationPrompt() {
  const enabled = useCitySwitchingEnabled();
  const onboarded = useOnboardingComplete();
  const { position, accuracy } = useGeolocation();
  const locationPrompt = useActiveLocationPrompt();
  const contributeOpen = useContributeModalOpen();
  const consentPrompt = useConsentPrompt();
  const consentReview = useConsentReview();
  const consentVisible = analyticsEnabled && (consentPrompt || consentReview);
  const storedPreference = getAutoSwitchCityPreference();
  const [preferenceOverride, setPreferenceOverride] = useState<
    AutoSwitchCityPreference | null | undefined
  >(undefined);
  const preference = preferenceOverride !== undefined ? preferenceOverride : storedPreference;
  const [sessionDismissed, setSessionDismissed] = useState(false);
  const switchedRef = useRef(false);
  const shownForRef = useRef<string | null>(null);

  const blocked =
    !enabled ||
    !onboarded ||
    sessionDismissed ||
    locationPrompt !== null ||
    contributeOpen ||
    consentVisible;

  const locatedCity =
    position === null || (accuracy !== null && accuracy > MAX_ACCURACY_METERS)
      ? null
      : cityForPosition(position.lng, position.lat, selectableCities);

  const mismatch =
    locatedCity !== null && locatedCity.slug !== currentCitySlug ? locatedCity : null;

  const promptCity = blocked || mismatch === null || preference !== null ? null : mismatch;

  useEffect(() => {
    if (blocked || mismatch === null || preference !== 'always' || switchedRef.current) return;
    switchedRef.current = true;
    track('city_location_auto_switched', { from: currentCitySlug, to: mismatch.slug });
    navigateToCity(mismatch);
  }, [blocked, mismatch, preference]);

  useEffect(() => {
    if (promptCity === null || shownForRef.current === promptCity.slug) return;
    shownForRef.current = promptCity.slug;
    track('city_location_prompt_shown', { from: currentCitySlug, to: promptCity.slug });
  }, [promptCity]);

  const accept = (remember: boolean) => {
    if (promptCity === null) return;
    track('city_location_prompt_accepted', {
      from: currentCitySlug,
      to: promptCity.slug,
      remembered: remember,
    });
    if (remember) {
      setAutoSwitchCityPreference('always');
      setPreferenceOverride('always');
    }
    switchedRef.current = true;
    navigateToCity(promptCity);
  };

  const decline = (remember: boolean) => {
    if (promptCity === null) return;
    track('city_location_prompt_declined', {
      from: currentCitySlug,
      to: promptCity.slug,
      remembered: remember,
    });
    if (remember) {
      setAutoSwitchCityPreference('never');
      setPreferenceOverride('never');
      return;
    }
    setSessionDismissed(true);
  };

  return { promptCity, accept, decline };
}
