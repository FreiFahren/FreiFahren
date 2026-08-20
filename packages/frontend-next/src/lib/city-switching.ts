import { useSyncExternalStore } from 'react';

import { CITIES, type CityConfig } from '@freifahren/cities';

import { FEATURE_FLAGS, getFeatureFlag, subscribeToFeatureFlags } from '@/lib/feature-flags';
import { isPreviewBuild } from '@/lib/utils';

// Single gate for choosing a city in-app: the settings switcher and the onboarding city step
// release together via the PostHog flag. With only one city there is nothing to choose, so both
// stay hidden regardless of the flag.

const includeUnlistedCities = import.meta.env.DEV || isPreviewBuild;

export const selectableCities: CityConfig[] = Object.values(CITIES).filter(
  (city) => city.listed !== false || includeUnlistedCities,
);

export function isCitySwitchingEnabled(): boolean {
  return selectableCities.length >= 2 && getFeatureFlag(FEATURE_FLAGS.citySwitcher);
}

export function useCitySwitchingEnabled(): boolean {
  return useSyncExternalStore(subscribeToFeatureFlags, isCitySwitchingEnabled);
}

export { subscribeToFeatureFlags as subscribeToCitySwitching };
