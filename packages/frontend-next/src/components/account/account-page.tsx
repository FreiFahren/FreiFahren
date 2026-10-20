import { useTranslation } from 'react-i18next';

import { useAccountsEnabled } from '@/lib/session';

import { AccountDetails } from './account-details';
import { AccountLayout } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { SignInGate } from './sign-in-gate';

export function AccountPage() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useAccountsEnabled();
  // No redirect: the flag reads as off until PostHog has loaded.
  return <AccountLayout title={t('title')}>{enabled && <AccountContent />}</AccountLayout>;
}

function AccountContent() {
  return <SignInGate>{({ user }) => <AccountDetails user={user} />}</SignInGate>;
}
