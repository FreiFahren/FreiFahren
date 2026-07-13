import type { ComponentType } from 'react';

import { Capacitor } from '@capacitor/core';

import { hasCityPreference, restoreCityPreference, subscribeCityPreference } from '@/lib/city';
import { isCitySwitchingEnabled, subscribeToCitySwitching } from '@/lib/city-switching';
import {
  isLegalDisclaimerAccepted,
  restoreLegalAcceptance,
  subscribeLegalDisclaimer,
} from '@/lib/legal-disclaimer';

import { CityStep } from './CityStep';
import { LegalStep } from './LegalStep';

// Each step fully describes itself — when it applies, what signals a change, how it restores after
// a native storage purge, and what it renders. Extending the flow means adding an entry; order is
// the order shown.
export type OnboardingStep = {
  id: string;
  isRequired: () => boolean;
  subscribe: (onChange: () => void) => () => void;
  restore: () => Promise<boolean>;
  Screen: ComponentType;
};

export const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    id: 'legal',
    isRequired: () => !isLegalDisclaimerAccepted(),
    subscribe: subscribeLegalDisclaimer,
    restore: restoreLegalAcceptance,
    Screen: LegalStep,
  },
  {
    id: 'city',
    // Web resolves the city from the subdomain; only native asks, and only when there's more than
    // one to choose from (see isCitySwitchingEnabled).
    isRequired: () =>
      Capacitor.isNativePlatform() && !hasCityPreference() && isCitySwitchingEnabled(),
    subscribe: (onChange) => {
      const unflag = subscribeToCitySwitching(onChange);
      const unpref = subscribeCityPreference(onChange);
      return () => {
        unflag();
        unpref();
      };
    },
    restore: restoreCityPreference,
    Screen: CityStep,
  },
];
