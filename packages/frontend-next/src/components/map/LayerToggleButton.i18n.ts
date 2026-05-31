import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'layerToggle';

i18n.addResourceBundle('en', NAMESPACE, {
  risk: 'Risk',
  showRiskLayer: 'Show risk layer',
  hideRiskLayer: 'Hide risk layer',
});

i18n.addResourceBundle('de', NAMESPACE, {
  risk: 'Risiko',
  showRiskLayer: 'Risiko-Ebene anzeigen',
  hideRiskLayer: 'Risiko-Ebene ausblenden',
});
