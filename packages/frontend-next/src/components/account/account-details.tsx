import { useNavigate } from '@tanstack/react-router';
import { LogOut, UserRound } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { FundAccountStatus } from '@/components/fund/fund-account-status';
import { authClient } from '@/lib/auth-client';
import { clearSessionToken } from '@/lib/session';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { NAMESPACE } from './account.i18n';
import { DeleteAccount } from './delete-account';

type User = { id: string; email: string; createdAt: Date | string };

// The settings card's rows.
const ROW =
  'flex w-full min-w-0 items-center gap-3 rounded-md px-3 py-2.5 text-left text-sm transition-colors outline-none';
const ACTION_ROW = `${ROW} hover:bg-muted focus-visible:bg-muted`;

export function AccountDetails({ user }: { user: User }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  const created = new Intl.DateTimeFormat(i18n.language, {
    month: 'long',
    year: 'numeric',
  }).format(new Date(user.createdAt));

  return (
    <>
      <div className="flex items-center gap-3 pt-2">
        <div className="bg-muted text-muted-foreground flex size-12 shrink-0 items-center justify-center rounded-full">
          <UserRound className="size-6" />
        </div>
        <div className="flex min-w-0 flex-1 flex-col">
          <p className="font-heading font-semibold break-all">{user.email}</p>
          <p className="text-muted-foreground text-xs">{t('accountCreated', { date: created })}</p>
        </div>
      </div>

      <FundAccountStatus userId={user.id} />

      <div className="-mx-3 flex flex-col">
        <SignOutRow />
      </div>

      <DeleteAccount email={user.email} />
    </>
  );
}

function SignOutRow() {
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
    <button
      type="button"
      disabled={signingOut}
      onClick={() => void signOut()}
      className={ACTION_ROW}
    >
      <LogOut className="text-muted-foreground size-4 shrink-0" />
      <span>{t('signOut')}</span>
    </button>
  );
}
