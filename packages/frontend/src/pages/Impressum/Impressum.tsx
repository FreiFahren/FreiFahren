import { useTranslation } from 'react-i18next'

import { LanguageSwitcher } from '../../components/Miscellaneous/LanguageSwitcher/LanguageSwitcher'

export const Impressum = () => {
    const { t } = useTranslation()

    return (
        <div className="legal-text">
            <h1>{t('Impressum.title')}</h1>
            <LanguageSwitcher title={t('Impressum.switchLanguage')} />
            <h2>{t('Impressum.sections.provider.title')}</h2>
            <p>{t('Impressum.sections.provider.content')}</p>

            <h2>{t('Impressum.sections.representatives.title')}</h2>
            <ul>
                {(t('Impressum.sections.representatives.content', { returnObjects: true }) as string[]).map(
                    (name, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={index}>{name}</li>
                    )
                )}
            </ul>

            <h2>{t('Impressum.sections.contact.title')}</h2>
            <p>{t('Impressum.sections.contact.address')}</p>
            <p>
                {t('Impressum.sections.contact.emailLabel')}{' '}
                <a href="mailto:johan@trieloff.net">{t('Impressum.sections.contact.email')}</a>
            </p>

            <h2>{t('Impressum.sections.responsible.title')}</h2>
            <ul>
                {(t('Impressum.sections.responsible.content', { returnObjects: true }) as string[]).map(
                    (name, index) => (
                        // eslint-disable-next-line react/no-array-index-key
                        <li key={index}>{name}</li>
                    )
                )}
            </ul>

            <h2>{t('Impressum.sections.disclaimer.title')}</h2>
            <p>{t('Impressum.sections.disclaimer.content')}</p>

            <h2>{t('Impressum.sections.copyright.title')}</h2>
            <p>{t('Impressum.sections.copyright.content')}</p>

            <h2>{t('Impressum.sections.privacy.title')}</h2>
            <p>{t('Impressum.sections.privacy.content')}</p>
        </div>
    )
}
