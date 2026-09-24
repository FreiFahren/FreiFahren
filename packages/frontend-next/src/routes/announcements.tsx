import { createFileRoute, redirect } from '@tanstack/react-router';

import { FEATURE_FLAGS, waitForFeatureFlag } from '@/lib/feature-flags';
import { Route as MapIndexRoute } from '@/routes/_map/index';

export const Route = createFileRoute('/announcements')({
  staticData: { legalDisclaimer: false },
  /*
   * Flags start out false until PostHog has loaded them, so checking the synchronous value would
   * bounce every cold deep link (a shared /announcements/<id> URL) back to the map. Wait for the
   * real value instead; the nested routes inherit this guard.
   */
  beforeLoad: async () => {
    if (!(await waitForFeatureFlag(FEATURE_FLAGS.announcements))) {
      throw redirect({ to: MapIndexRoute.to, replace: true });
    }
  },
});
