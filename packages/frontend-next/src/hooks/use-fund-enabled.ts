import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { useAccountsEnabled } from '@/lib/session';
import { optionalEnv } from '@/lib/utils';

export function useFundEnabled(): boolean {
  const fundEnabled = useFeatureFlag(FEATURE_FLAGS.fund);
  const accountsEnabled = useAccountsEnabled();
  // Without a Fund Worker to talk to, every Fund request fails, so the Fund is off.
  return fundEnabled && accountsEnabled && optionalEnv('VITE_FUND_URL') !== undefined;
}
