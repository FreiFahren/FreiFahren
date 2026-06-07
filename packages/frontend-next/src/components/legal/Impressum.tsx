import { Link } from '@tanstack/react-router';
import { useTranslation } from 'react-i18next';

import { LegalPage } from './LegalPage';
import { NAMESPACE } from './Impressum.i18n';

export function Impressum() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <LegalPage title={t('title')}>
      <section>
        <h2>{t('sections.provider.title')}</h2>
        <p>
          {t('sections.provider.name')}
          <br />
          {t('sections.provider.careOf')}
          <br />
          {t('sections.provider.street')}
          <br />
          {t('sections.provider.city')}
        </p>
      </section>

      <section>
        <h2>{t('sections.contact.title')}</h2>
        <p>
          {t('sections.contact.emailLabel')}{' '}
          <a href="mailto:contact@freifahren.org">contact@freifahren.org</a>
        </p>
        <p>{t('sections.contact.form')}</p>
      </section>

      <section>
        <h2>{t('sections.representedBy.title')}</h2>
        <p>{t('sections.representedBy.content')}</p>
      </section>

      <section>
        <h2>{t('sections.register.title')}</h2>
        <p>{t('sections.register.content')}</p>
      </section>

      <section>
        <h2>{t('sections.vat.title')}</h2>
        <p>{t('sections.vat.content')}</p>
      </section>

      <section>
        <Link to="/privacy" preload={false}>
          {t('links.privacy')}
        </Link>
      </section>
    </LegalPage>
  );
}
