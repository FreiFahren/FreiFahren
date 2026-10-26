import { useTranslation } from 'react-i18next';

import { FundAccountStatus } from '@/components/fund/fund-account-status';
import { useAccountsEnabled } from '@/lib/session';

import { AccountActions, AccountDetails } from './account-details';
import { AccountLayout, PRIMARY_BUTTON } from './account-layout';
import { NAMESPACE } from './account.i18n';
import { SignInGate } from './sign-in-gate';
import { UsernameForm } from './username-form';

export function AccountPage() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useAccountsEnabled();
  // No redirect: the flag reads as off until PostHog has loaded.
  return <AccountLayout title={t('title')}>{enabled && <AccountContent />}</AccountLayout>;
}

function AccountContent() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <SignInGate>
      {({ user }, refetch) => {
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
              <FundAccountStatus />
              <AccountActions />
            </>
          );
        }
        return <AccountDetails user={user} />;
      }}
    </SignInGate>
  );
}
