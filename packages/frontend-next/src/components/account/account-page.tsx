import { useTranslation } from 'react-i18next';

import { authClient } from '@/lib/auth-client';
import { useAccountsEnabled } from '@/lib/session';

import { AccountDetails } from './account-details';
import { AccountLayout } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { SignInForm } from './sign-in-form';

export function AccountPage() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useAccountsEnabled();
  // An empty page rather than a redirect: the flag reads as off until PostHog has loaded, and a
  // redirect would throw flagged users out on every direct visit.
  return <AccountLayout title={t('title')}>{enabled && <AccountContent />}</AccountLayout>;
}

// Separate so the session is only fetched once the flag is on.
function AccountContent() {
  const session = authClient.useSession();

  return (
    <>
      {session.data ? (
        <AccountDetails user={session.data.user} />
      ) : session.isPending && !session.isRefetching ? null : (
        // A signed-out session reads as pending again on every focus refetch; only the first
        // load may hide the form, or refocusing the window would reset a half-done sign-in.
        <SignInForm onSignedIn={() => void session.refetch()} />
      )}
    </>
  );
}
