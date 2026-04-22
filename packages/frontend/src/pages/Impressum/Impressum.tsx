import { useTranslation } from 'react-i18next'
import { Link } from 'react-router-dom'

import { LanguageSwitcher } from '../../components/Miscellaneous/LanguageSwitcher/LanguageSwitcher'

const Impressum = () => {
    const { t } = useTranslation()

    return (
        <div className="legal-text">
            <h1>{t('Impressum.title')}</h1>
            <div className="row">
                <LanguageSwitcher title={t('Impressum.switchLanguage')} />
            </div>

            <h2>{t('Impressum.sections.provider.title')}</h2>
            <p>{t('Impressum.sections.provider.name')}</p>
            <p>{t('Impressum.sections.provider.careOf')}</p>
            <p>{t('Impressum.sections.provider.street')}</p>
            <p>{t('Impressum.sections.provider.city')}</p>

            <h2>{t('Impressum.sections.contact.title')}</h2>
            <p>
                {t('Impressum.sections.contact.emailLabel')}{' '}
                <a href="mailto:contact@freifahren.org">contact@freifahren.org</a>
            </p>
            <p>{t('Impressum.sections.contact.form')}</p>

            <h2>{t('Impressum.sections.representedBy.title')}</h2>
            <p>{t('Impressum.sections.representedBy.content')}</p>

            <ul className="row" style={{ marginTop: '24px' }}>
                <li>
                    <Link to="/datenschutz">{t('Impressum.links.privacy')}</Link>
                </li>
                <li>
                    <Link to="/support">{t('Impressum.links.support')}</Link>
                </li>
            </ul>
        </div>
    )
}

export { Impressum }
