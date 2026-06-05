import { useTranslation } from 'react-i18next';

import { LegalPage } from './LegalPage';
import { NAMESPACE } from './PrivacyPolicy.i18n';

export function PrivacyPolicy() {
  const { t } = useTranslation(NAMESPACE);
  const toArray = (key: string) => t(key, { returnObjects: true }) as unknown as string[];
  const toValues = (key: string) =>
    Object.values(t(key, { returnObjects: true }) as unknown as Record<string, string>);

  return (
    <LegalPage title={t('title')}>
      <section>
        <h2>{t('sections.preamble.title')}</h2>
        <p>{t('sections.preamble.content')}</p>
      </section>

      <section>
        <h2>{t('sections.responsible.title')}</h2>
        <p>{t('sections.responsible.content')}</p>
      </section>

      <section>
        <h2>{t('sections.legalBasis.title')}</h2>
        <p>{t('sections.legalBasis.content')}</p>
        <ul>
          <li>{t('sections.legalBasis.consent')}</li>
          <li>{t('sections.legalBasis.legitimateInterest')}</li>
        </ul>
      </section>

      <section>
        <h2>{t('sections.dataUsage.title')}</h2>
        <p>{t('sections.dataUsage.content')}</p>

        <h3>{t('sections.dataUsage.reportFormTitle')}</h3>
        <ul>
          {toArray('sections.dataUsage.dataPoints').map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t('sections.dataUsage.reportPurpose')}</p>
        <p>{t('sections.dataUsage.ipAddressInfo')}</p>

        <h3>{t('sections.dataUsage.feedbackFormTitle')}</h3>
        <ul>
          {toArray('sections.dataUsage.feedbackDataPoints').map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t('sections.dataUsage.feedbackPurpose')}</p>

        <h3>{t('sections.dataUsage.paymentFormTitle')}</h3>
        <ul>
          {toArray('sections.dataUsage.paymentDataPoints').map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
        <p>{t('sections.dataUsage.paymentPurpose')}</p>
      </section>

      <section>
        <h2>{t('sections.anonymity.title')}</h2>
        <p>{t('sections.anonymity.content')}</p>
      </section>

      <section>
        <h2>{t('sections.storageAndAccess.title')}</h2>
        <p>{t('sections.storageAndAccess.content')}</p>
      </section>

      <section>
        <h2>{t('sections.userRights.title')}</h2>
        <p>{t('sections.userRights.intro')}</p>
        <ul>
          {toValues('sections.userRights.rightsList').map((right) => (
            <li key={right}>{right}</li>
          ))}
        </ul>
        <p>{t('sections.userRights.contact')}</p>
      </section>

      <section>
        <h2>{t('sections.consent.title')}</h2>
        <p>{t('sections.consent.content')}</p>
      </section>

      <section>
        <h2>{t('sections.dataProtectionOfficer.title')}</h2>
        <p>{t('sections.dataProtectionOfficer.content')}</p>
      </section>

      <section>
        <h2>{t('sections.policyChanges.title')}</h2>
        <p>{t('sections.policyChanges.content')}</p>
      </section>

      <section>
        <h2>{t('sections.telegramMessages.title')}</h2>
        <p>{t('sections.telegramMessages.content')}</p>
      </section>

      <section>
        <h2>{t('sections.errorMonitoring.title')}</h2>
        <p>{t('sections.errorMonitoring.description')}</p>
        <ul>
          <li>{t('sections.errorMonitoring.dataPoints.os')}</li>
          <li>{t('sections.errorMonitoring.dataPoints.appVersion')}</li>
          <li>{t('sections.errorMonitoring.dataPoints.device')}</li>
          <li>{t('sections.errorMonitoring.dataPoints.state')}</li>
        </ul>
        <p>{t('sections.errorMonitoring.storage')}</p>
      </section>

      <section>
        <h2>{t('sections.appStores.title')}</h2>
        <p>{t('sections.appStores.content')}</p>
      </section>

      <section>
        <h2>{t('sections.internationalTransfers.title')}</h2>
        <p>{t('sections.internationalTransfers.content')}</p>
        <ul>
          {toValues('sections.internationalTransfers.transfers').map((transfer) => (
            <li key={transfer}>{transfer}</li>
          ))}
        </ul>
        <p>{t('sections.internationalTransfers.rights')}</p>
      </section>

      <section>
        <h2>{t('sections.dataProcessing.title')}</h2>
        <p>{t('sections.dataProcessing.content')}</p>
      </section>
    </LegalPage>
  );
}
