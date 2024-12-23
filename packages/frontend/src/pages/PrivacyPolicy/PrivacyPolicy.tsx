import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { REPORT_COOLDOWN_MINUTES } from '../../constants'

import { LanguageSwitcher } from '../../components/Miscellaneous/LanguageSwitcher/LanguageSwitcher'

const PrivacyPolicy = () => {
    const { t, i18n } = useTranslation()

    const [modifiedDate, setModifiedDate] = useState('')

    useEffect(() => {
        ;(async () => {
            try {
                // eslint-disable-next-line no-restricted-globals
                const privacyPolicyMeta = await fetch(`${location.origin}/privacyPolicyMeta.json`).then((res) =>
                    res.json()
                )

                const formattedModifiedDate = new Date(privacyPolicyMeta.lastModified).toLocaleDateString(
                    i18n.language,
                    {
                        year: 'numeric',
                        month: 'numeric',
                        day: 'numeric',
                    }
                )

                setModifiedDate(formattedModifiedDate)
            } catch (error) {
                // fix later with sentry
                // eslint-disable-next-line no-console
                console.error('Error getting privacy policy meta', error)
            }
        })().catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Error getting privacy policy meta', error)
        })
    }, [i18n.language])

    return (
        <div className="legal-text">
            <h1>{t('PrivacyPolicy.title')}</h1>
            <div className="row">
                <p>{t('PrivacyPolicy.lastUpdate', { lastUpdate: modifiedDate })}</p>
                <LanguageSwitcher title={t('PrivacyPolicy.switchLanguage')} />
            </div>

            <h2>{t('PrivacyPolicy.sections.preamble.title')}</h2>
            <p>{t('PrivacyPolicy.sections.preamble.content')}</p>

            <h2>{t('PrivacyPolicy.sections.responsible.title')}</h2>
            <p>
                {t('PrivacyPolicy.sections.responsible.content', {
                    email: <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>,
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
                {(t('PrivacyPolicy.sections.dataUsage.dataPoints', { returnObjects: true }) as string[]).map(
                    (item, index) => (
                        // fix later
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={index}>{item}</li>
                    )
                )}
            </ul>
            <p>{t('PrivacyPolicy.sections.dataUsage.purpose', { minutes: REPORT_COOLDOWN_MINUTES })}</p>

            <h2>{t('PrivacyPolicy.sections.anonymity.title')}</h2>
            <p>{t('PrivacyPolicy.sections.anonymity.content')}</p>

            <h2>{t('PrivacyPolicy.sections.storageAndAccess.title')}</h2>
            <p>{t('PrivacyPolicy.sections.storageAndAccess.content')}</p>

            <h2>{t('PrivacyPolicy.sections.userRights.title')}</h2>
            <p>
                {t('PrivacyPolicy.sections.userRights.content', {
                    email: <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>,
                })}
            </p>

            <h2>{t('PrivacyPolicy.sections.consent.title')}</h2>
            <p>{t('PrivacyPolicy.sections.consent.content')}</p>

            <h2>{t('PrivacyPolicy.sections.dataProtectionOfficer.title')}</h2>
            <p>
                {t('PrivacyPolicy.sections.dataProtectionOfficer.content', {
                    email: <a href="mailto:johan@trieloff.net">johan@trieloff.net</a>,
                })}
            </p>

            <h2>{t('PrivacyPolicy.sections.policyChanges.title')}</h2>
            <p>{t('PrivacyPolicy.sections.policyChanges.content')}</p>

            <h2>{t('PrivacyPolicy.sections.telegramMessages.title')}</h2>
            <p>{t('PrivacyPolicy.sections.telegramMessages.content')}</p>

            <h2>{t('PrivacyPolicy.sections.analytics.title')}</h2>
            <p>{t('PrivacyPolicy.sections.analytics.content')}</p>
            <p>{t('PrivacyPolicy.sections.analytics.usage')}</p>

            <h2>{t('PrivacyPolicy.sections.errorMonitoring.title')}</h2>
            <p>{t('PrivacyPolicy.sections.errorMonitoring.description')}</p>
            <ul>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.os')}</li>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.appVersion')}</li>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.device')}</li>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.state')}</li>
            </ul>
            <p>{t('PrivacyPolicy.sections.errorMonitoring.storage')}</p>

            <h2>{t('PrivacyPolicy.sections.severabilityClause.title')}</h2>
            <p>{t('PrivacyPolicy.sections.severabilityClause.content')}</p>
        </div>
    )
}

export { PrivacyPolicy }
