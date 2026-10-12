import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authClient } from '@/lib/auth-client';
import { useAccountsEnabled } from '@/lib/session';

import { AccountDetails } from './account-details';
import { AccountLayout, PRIMARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { SignInForm } from './sign-in-form';
import { UsernameForm } from './username-form';

export function AccountPage() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useAccountsEnabled();
  // An empty page rather than a redirect: the flag reads as off until PostHog has loaded, and a
  // redirect would throw flagged users out on every direct visit.
  return <AccountLayout title={t('title')}>{enabled && <AccountContent />}</AccountLayout>;
}

// Separate so the session is only fetched once the flag is on.
function AccountContent() {
  const { t } = useTranslation(NAMESPACE);
  const session = authClient.useSession();
  // Better Auth marks every fetch as pending while there's no session, including the refetch on each
  // window focus, so only whether one has finished tells the first load apart. Until then nothing
  // shows, rather than a sign-in form that flashes for signed-in users; after it, the form stays, so
  // refocusing doesn't reset a half-done sign-in.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !session.isPending) setLoaded(true);

  return (
    <>
      {session.data && !session.data.user.name ? (
        // Accounts are created by their first sign-in, without a username; this is where they get one.
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-lg font-semibold">{t('chooseUsernameTitle')}</h2>
            <p className="text-muted-foreground text-sm">{t('chooseUsernameIntro')}</p>
          </div>
          <UsernameForm
            initial=""
            submitLabel={t('continue')}
            submitClassName={PRIMARY_BUTTON}
            onSaved={() => void session.refetch()}
          />
        </>
      ) : session.data ? (
        <AccountDetails user={session.data.user} />
      ) : !loaded ? null : (
        <SignInForm onSignedIn={() => void session.refetch()} />
      )}
    </>
  );
}
