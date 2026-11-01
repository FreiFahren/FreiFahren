import { useTranslation } from 'react-i18next';

import { fundPrivacyUrl } from '@/lib/privacy-policy';

import { NAMESPACE } from './fund.i18n';

// Information, not consent: the Fund's legal basis is the membership, so the policy is only linked.
export function FundPrivacyNote({ className = '' }: { className?: string }) {
  const { t, i18n } = useTranslation(NAMESPACE);
  return (
    <p className={`text-muted-foreground text-xs ${className}`}>
      {t('privacyNotice')}{' '}
      <a
        href={fundPrivacyUrl(i18n.resolvedLanguage)}
        target="_blank"
        rel="noopener noreferrer"
        className="text-foreground underline"
      >
        {t('privacyLink')}
      </a>
    </p>
  );
}
