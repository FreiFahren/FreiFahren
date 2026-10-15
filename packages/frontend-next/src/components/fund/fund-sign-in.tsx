import { useTranslation } from 'react-i18next';

import { SignInForm } from '@/components/account/sign-in-form';

import { FundIntroduction } from './fund-introduction';
import { NAMESPACE } from './fund.i18n';

export function FundSignIn({ onSignedIn }: { onSignedIn: () => void }) {
  const { t } = useTranslation(NAMESPACE);
  return (
    <FundIntroduction>
      <section aria-labelledby="fund-sign-in-title">
        <h3 id="fund-sign-in-title" className="font-heading mb-3 text-base font-semibold">
          {t('signInTitle')}
        </h3>
        <SignInForm onSignedIn={onSignedIn} />
      </section>
    </FundIntroduction>
  );
}
