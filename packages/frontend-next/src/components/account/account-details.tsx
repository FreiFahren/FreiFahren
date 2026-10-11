import { Capacitor } from '@capacitor/core';
import { useNavigate } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useId, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import { currentCity } from '@/lib/city';
import { clearSessionToken } from '@/lib/session';
import { Route as MapIndexRoute } from '@/routes/_map/index';
import { Route as DeleteAccountRoute } from '@/routes/account/delete';

import { BUTTON_SHAPE, DevEmailHint, INPUT, SECONDARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { UsernameForm } from './username-form';

type User = { name: string; email: string; createdAt: Date | string };

// The emailed link has to open a web page: a native app's own origin (capacitor://localhost) means
// nothing in a mail client, so native apps send their city's public web app instead.
function deletePageUrl(): string {
  const origin = Capacitor.isNativePlatform() ? currentCity.publicAppUrl : window.location.origin;
  return new URL(DeleteAccountRoute.to, origin).toString();
}

export function AccountDetails({ user }: { user: User }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const emailId = useId();
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);
  const memberSince = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(user.createdAt));

  const signOut = async () => {
    setSigningOut(true);
    // The token goes either way: a failed sign-out must not leave this device signed in.
    await authClient.signOut().catch(() => undefined);
    await clearSessionToken();
    void navigate({ to: MapIndexRoute.to });
  };

  return (
    <>
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <div className="bg-muted text-muted-foreground flex size-20 items-center justify-center rounded-full">
          <UserRound className="size-10" />
        </div>
        <div className="flex flex-col gap-0.5">
          <p className="font-heading text-lg font-semibold">{user.name}</p>
          <p className="text-muted-foreground text-sm">{t('memberSince', { date: memberSince })}</p>
        </div>
      </div>

      <UsernameForm
        initial={user.name}
        submitLabel={t('save')}
        submitClassName={SECONDARY_BUTTON}
      />

      <div className="flex flex-col gap-2">
        <label htmlFor={emailId} className="text-sm font-semibold">
          {t('emailLabel')}
        </label>
        <Input id={emailId} className={INPUT} type="email" value={user.email} readOnly />
      </div>

      <Button
        variant="secondary"
        size="lg"
        disabled={signingOut}
        onClick={() => void signOut()}
        className={SECONDARY_BUTTON}
      >
        {t('signOut')}
      </Button>

      <Separator />

      <DeleteAccountRequest email={user.email} />
    </>
  );
}

function DeleteAccountRequest({ email }: { email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const [state, setState] = useState<'idle' | 'pending' | 'sent' | 'error'>('idle');

  const requestDeletion = async () => {
    setState('pending');
    const { error } = await authClient.deleteUser({ callbackURL: deletePageUrl() });
    setState(error ? 'error' : 'sent');
  };

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-semibold">{t('deleteTitle')}</h2>
      {state === 'sent' ? (
        <>
          <p role="status" className="text-sm">
            {t('deleteLinkSent', { email })}
          </p>
          <DevEmailHint />
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm">{t('deleteIntro')}</p>
          {state === 'error' && (
            <p role="alert" className="text-destructive text-sm">
              {t('genericError')}
            </p>
          )}
          <Button
            variant="destructive"
            size="lg"
            disabled={state === 'pending'}
            onClick={() => void requestDeletion()}
            className={BUTTON_SHAPE}
          >
            {t('deleteRequest')}
          </Button>
        </>
      )}
    </section>
  );
}
