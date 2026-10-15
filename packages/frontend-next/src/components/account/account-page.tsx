import { LoaderCircle } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { authClient } from '@/lib/auth-client';
import { useAccountsEnabled } from '@/lib/session';

import { AccountActions, AccountDetails } from './account-details';
import { AccountLayout, PRIMARY_BUTTON, SECONDARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { SignInForm } from './sign-in-form';
import { UsernameForm } from './username-form';

export function AccountPage() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useAccountsEnabled();
  // No redirect: the flag reads as off until PostHog has loaded.
  return <AccountLayout title={t('title')}>{enabled && <AccountContent />}</AccountLayout>;
}

function AccountContent() {
  const { t } = useTranslation(NAMESPACE);
  const session = authClient.useSession();
  // A 401 means signed out; any other error says nothing about it.
  const failed = !session.data && session.error !== null && session.error.status !== 401;
  // Better Auth reports every signed-out refetch (e.g. on window focus) as pending, so only the first
  // load may hide the sign-in form; later ones would reset a half-done sign-in.
  const [loaded, setLoaded] = useState(false);
  if (!loaded && !session.isPending && !failed) setLoaded(true);

  const refetch = () => void session.refetch();

  if (session.data) {
    const { user } = session.data;
    // New accounts have no username yet.
    if (!user.name) {
      return (
        <>
          <div className="flex flex-col gap-1">
            <h2 className="font-heading text-lg font-semibold">{t('chooseUsernameTitle')}</h2>
            <p className="text-muted-foreground text-sm">{t('chooseUsernameIntro')}</p>
          </div>
          <UsernameForm
            initial=""
            submitLabel={t('continue')}
            submitClassName={PRIMARY_BUTTON}
            onSaved={refetch}
          />
          <AccountActions email={user.email} />
        </>
      );
    }
    return <AccountDetails user={user} />;
  }

  if (loaded) return <SignInForm onSignedIn={refetch} />;

  if (failed) {
    return (
      <>
        <p role="alert" className="text-destructive text-sm">
          {t('sessionLoadFailed')}
        </p>
        <Button
          variant="secondary"
          size="lg"
          disabled={session.isPending}
          onClick={refetch}
          className={SECONDARY_BUTTON}
        >
          {t('retry')}
        </Button>
      </>
    );
  }

  return (
    <LoaderCircle
      role="status"
      aria-label={t('loading')}
      className="text-muted-foreground mx-auto size-6 animate-spin"
    />
  );
}
