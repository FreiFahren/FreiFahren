import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { useAccountsEnabled } from '@/lib/session';

export function useFundEnabled(): boolean {
  const fundEnabled = useFeatureFlag(FEATURE_FLAGS.fund);
  const accountsEnabled = useAccountsEnabled();
  return fundEnabled && accountsEnabled;
}
