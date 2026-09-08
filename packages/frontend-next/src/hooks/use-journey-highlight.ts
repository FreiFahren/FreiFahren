import { useSyncExternalStore } from 'react';

import { getJourneyHighlight, subscribeToJourneyHighlight } from '@/lib/journey-highlight';

/** Segment ids of the journey on screen; see lib/journey-highlight for why this is a store. */
export function useJourneyHighlight(): readonly number[] {
  return useSyncExternalStore(subscribeToJourneyHighlight, getJourneyHighlight);
}
