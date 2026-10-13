import { useNavigate } from '@tanstack/react-router';
import { UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { authClient } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { SECONDARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { DeleteAccount } from './delete-account';
import { UsernameForm } from './username-form';

type User = { name: string; email: string; createdAt: Date | string };

export function AccountDetails({ user }: { user: User }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const created = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(user.createdAt));

  return (
    <>
      <div className="flex flex-col items-center gap-3 pt-4 text-center">
        <div className="bg-muted text-muted-foreground flex size-20 items-center justify-center rounded-full">
          <UserRound className="size-10" />
        </div>
        <div className="flex w-full flex-col gap-0.5">
          <p className="font-heading text-lg font-semibold break-words">{user.name}</p>
          <p className="text-muted-foreground text-sm">{t('accountCreated', { date: created })}</p>
        </div>
      </div>

      <UsernameForm
        initial={user.name}
        submitLabel={t('save')}
        submitClassName={SECONDARY_BUTTON}
      />

      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold">{t('emailLabel')}</p>
        <p className="text-muted-foreground text-sm break-all">{user.email}</p>
      </div>

      <AccountActions email={user.email} />
    </>
  );
}

// Also offered before a new account has a username.
export function AccountActions({ email }: { email: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const [signingOut, setSigningOut] = useState(false);

  const signOut = async () => {
    setSigningOut(true);
    // The token goes either way: a failed sign-out must not leave this device signed in.
    await authClient.signOut().catch(() => undefined);
    await clearSessionToken();
    void navigate({ to: MapIndexRoute.to });
  };

  return (
    <>
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

      <DeleteAccount email={email} />
    </>
  );
}
