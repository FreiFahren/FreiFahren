import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '../../components/Miscellaneous/LanguageSwitcher/LanguageSwitcher'
import { REPORT_COOLDOWN_MINUTES } from '../../constants'

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
            <p>{t('PrivacyPolicy.sections.responsible.content')}</p>

            <h2>{t('PrivacyPolicy.sections.legalBasis.title')}</h2>
            <p>{t('PrivacyPolicy.sections.legalBasis.content')}</p>
            <div className="data-usage-content">
                <ul>
                    <li>{t('PrivacyPolicy.sections.legalBasis.consent')}</li>
                    <li>{t('PrivacyPolicy.sections.legalBasis.legitimateInterest')}</li>
                </ul>
            </div>

            <h2>{t('PrivacyPolicy.sections.dataUsage.title')}</h2>
            <div className="data-usage-content">
                <p>{t('PrivacyPolicy.sections.dataUsage.content')}</p>
                <h3>{t('PrivacyPolicy.sections.dataUsage.reportFormTitle')}</h3>
                <ul>
                    {(t('PrivacyPolicy.sections.dataUsage.dataPoints', { returnObjects: true }) as string[]).map(
                        (item) => (
                            <li key={item}>{item}</li>
                        )
                    )}
                </ul>
                <p>{t('PrivacyPolicy.sections.dataUsage.reportPurpose')}</p>
                <p>{t('PrivacyPolicy.sections.dataUsage.ipAddressInfo', { minutes: REPORT_COOLDOWN_MINUTES })}</p>

                <h3>{t('PrivacyPolicy.sections.dataUsage.feedbackFormTitle')}</h3>
                <ul>
                    {(t('PrivacyPolicy.sections.dataUsage.feedbackDataPoints', { returnObjects: true }) as string[]).map(
                        (item) => (
                            <li key={item}>{item}</li>
                        )
                    )}
                </ul>
                <p>{t('PrivacyPolicy.sections.dataUsage.feedbackPurpose')}</p>

                <h3>{t('PrivacyPolicy.sections.dataUsage.paymentFormTitle')}</h3>
                <ul>
                    {(t('PrivacyPolicy.sections.dataUsage.paymentDataPoints', { returnObjects: true }) as string[]).map(
                        (item) => (
                            <li key={item}>{item}</li>
                        )
                    )}
                </ul>
                <p>{t('PrivacyPolicy.sections.dataUsage.paymentPurpose')}</p>
            </div>

            <h2>{t('PrivacyPolicy.sections.anonymity.title')}</h2>
            <p>{t('PrivacyPolicy.sections.anonymity.content')}</p>

            <h2>{t('PrivacyPolicy.sections.storageAndAccess.title')}</h2>
            <p>{t('PrivacyPolicy.sections.storageAndAccess.content')}</p>

            <h2>{t('PrivacyPolicy.sections.userRights.title')}</h2>
            <p>{t('PrivacyPolicy.sections.userRights.intro')}</p>
            <div className="data-usage-content">
                <ul>
                    {Object.values(
                        t('PrivacyPolicy.sections.userRights.rightsList', { returnObjects: true }) as Record<
                            string,
                            string
                        >
                    ).map((right) => (
                        <li key={right}>{right}</li>
                    ))}
                </ul>
                <p>{t('PrivacyPolicy.sections.userRights.contact')}</p>
            </div>

            <h2>{t('PrivacyPolicy.sections.consent.title')}</h2>
            <p>{t('PrivacyPolicy.sections.consent.content')}</p>

            <h2>{t('PrivacyPolicy.sections.dataProtectionOfficer.title')}</h2>
            <p>{t('PrivacyPolicy.sections.dataProtectionOfficer.content')}</p>

            <h2>{t('PrivacyPolicy.sections.policyChanges.title')}</h2>
            <p>{t('PrivacyPolicy.sections.policyChanges.content')}</p>

            <h2>{t('PrivacyPolicy.sections.telegramMessages.title')}</h2>
            <p>{t('PrivacyPolicy.sections.telegramMessages.content')}</p>

            <h2>{t('PrivacyPolicy.sections.errorMonitoring.title')}</h2>
            <p>{t('PrivacyPolicy.sections.errorMonitoring.description')}</p>
            <ul>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.os')}</li>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.appVersion')}</li>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.device')}</li>
                <li>{t('PrivacyPolicy.sections.errorMonitoring.dataPoints.state')}</li>
            </ul>
            <p>{t('PrivacyPolicy.sections.errorMonitoring.storage')}</p>

            <h2>{t('PrivacyPolicy.sections.appStores.title')}</h2>
            <p>{t('PrivacyPolicy.sections.appStores.content')}</p>

            <h2>{t('PrivacyPolicy.sections.internationalTransfers.title')}</h2>
            <p>{t('PrivacyPolicy.sections.internationalTransfers.content')}</p>
            <div className="data-usage-content">
                <ul>
                    <li>{t('PrivacyPolicy.sections.internationalTransfers.transfers.cloudflare')}</li>
                    <li>{t('PrivacyPolicy.sections.internationalTransfers.transfers.sentry')}</li>
                    <li>{t('PrivacyPolicy.sections.internationalTransfers.transfers.telegram')}</li>
                    <li>{t('PrivacyPolicy.sections.internationalTransfers.transfers.stripe')}</li>
                </ul>
                <p>{t('PrivacyPolicy.sections.internationalTransfers.rights')}</p>
            </div>

            <h2>{t('PrivacyPolicy.sections.dataProcessing.title')}</h2>
            <p>{t('PrivacyPolicy.sections.dataProcessing.content')}</p>
        </div>
    )
}

export { PrivacyPolicy }
