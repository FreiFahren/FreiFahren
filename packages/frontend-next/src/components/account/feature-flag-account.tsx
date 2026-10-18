import { useEffect } from 'react';

import { setPostHogFlagAccount } from '@/lib/posthog-client';

export function FeatureFlagAccount({ userId }: { userId: string | null }) {
  useEffect(() => {
    setPostHogFlagAccount(userId);
  }, [userId]);
  return null;
}
