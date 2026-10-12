import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { authClient } from '@/lib/auth-client';
import { useAccountsEnabled } from '@/lib/session';

import { AccountDetails } from './account-details';
import { Button } from '@/components/ui/button';

import { AccountLayout, PRIMARY_BUTTON, SECONDARY_BUTTON } from './account-layout';
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
  // A 401 means signed out. Anything else (offline, the auth-worker down) says nothing about whether
  // this device is signed in, so it must not lead to the sign-in form.
  const failed = !session.data && session.error !== null && session.error.status !== 401;
  // Better Auth marks every fetch as pending while there's no session, including the refetch on each
  // window focus, so only whether one has succeeded tells the first load apart. Until then a spinner
  // shows, rather than a sign-in form that flashes for signed-in users; after it, the form stays, so
  // refocusing doesn't reset a half-done sign-in.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !session.isPending && !failed) setLoaded(true);

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
      ) : loaded ? (
        <SignInForm onSignedIn={() => void session.refetch()} />
      ) : failed ? (
        <>
          <p role="alert" className="text-destructive text-sm">
            {t('sessionLoadFailed')}
          </p>
          <Button
            variant="secondary"
            size="lg"
            disabled={session.isPending}
            onClick={() => void session.refetch()}
            className={SECONDARY_BUTTON}
          >
            {t('retry')}
          </Button>
        </>
      ) : (
        <LoaderCircle
          role="status"
          aria-label={t('loading')}
          className="text-muted-foreground mx-auto size-6 animate-spin"
        />
      )}
    </>
  );
}
