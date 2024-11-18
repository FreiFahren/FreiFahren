import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from '../../components/Miscellaneous/LanguageSwitcher';

const PrivacyPolicy = () => {
    const { t } = useTranslation();

    return (
        <div className="legal-text">
            <h1>{t('PrivacyPolicy.title')}</h1>
            <div className="row">
                <p>{t('PrivacyPolicy.lastUpdate')}</p>
                <LanguageSwitcher title={t("PrivacyPolicy.switchLanguage")} />
            </div>

            <h2>{t('PrivacyPolicy.sections.preamble.title')}</h2>
            <p>{t('PrivacyPolicy.sections.preamble.content')}</p>

            <h2>{t('PrivacyPolicy.sections.responsible.title')}</h2>
            <p>
                {t('PrivacyPolicy.sections.responsible.content', {
                    email: <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>
                })}
            </p>

            <h2>{t('PrivacyPolicy.sections.legalBasis.title')}</h2>
            <p>{t('PrivacyPolicy.sections.legalBasis.content')}</p>
            <ul>
                <li>{t('PrivacyPolicy.sections.legalBasis.consent')}</li>
                <li>{t('PrivacyPolicy.sections.legalBasis.contract')}</li>
                <li>{t('PrivacyPolicy.sections.legalBasis.legitimateInterest')}</li>
            </ul>

            <h2>{t('PrivacyPolicy.sections.dataUsage.title')}</h2>
            <p>{t('PrivacyPolicy.sections.dataUsage.content')}</p>
            <ul>
                {(t('PrivacyPolicy.sections.dataUsage.dataPoints', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
            <p>{t('PrivacyPolicy.sections.dataUsage.purpose')}</p>

            <h2>{t('PrivacyPolicy.sections.anonymity.title')}</h2>
            <p>{t('PrivacyPolicy.sections.anonymity.content')}</p>

            <h2>{t('PrivacyPolicy.sections.storageAndAccess.title')}</h2>
            <p>{t('PrivacyPolicy.sections.storageAndAccess.content')}</p>

            <h2>{t('PrivacyPolicy.sections.userRights.title')}</h2>
            <p>
                {t('PrivacyPolicy.sections.userRights.content', {
                    email: <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>
                })}
            </p>

            <h2>{t('PrivacyPolicy.sections.consent.title')}</h2>
            <p>{t('PrivacyPolicy.sections.consent.content')}</p>

            <h2>{t('PrivacyPolicy.sections.dataProtectionOfficer.title')}</h2>
            <p>
                {t('PrivacyPolicy.sections.dataProtectionOfficer.content', {
                    email: <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>
                })}
            </p>

            <h2>{t('PrivacyPolicy.sections.policyChanges.title')}</h2>
            <p>{t('PrivacyPolicy.sections.policyChanges.content')}</p>

            <h2>{t('PrivacyPolicy.sections.telegramMessages.title')}</h2>
            <p>{t('PrivacyPolicy.sections.telegramMessages.content')}</p>

            <h2>{t('PrivacyPolicy.sections.analytics.title')}</h2>
            <p>{t('PrivacyPolicy.sections.analytics.content')}</p>
            <ul>
                {(t('PrivacyPolicy.sections.analytics.dataPoints', { returnObjects: true }) as string[]).map((item, index) => (
                    <li key={index}>{item}</li>
                ))}
            </ul>
            <p>{t('PrivacyPolicy.sections.analytics.usage')}</p>

            <h2>{t('PrivacyPolicy.sections.severabilityClause.title')}</h2>
            <p>{t('PrivacyPolicy.sections.severabilityClause.content')}</p>
        </div>
    );
};

export default PrivacyPolicy;
