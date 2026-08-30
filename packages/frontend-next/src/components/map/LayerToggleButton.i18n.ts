import { i18n } from '@/lib/i18n';

export const NAMESPACE = 'layerToggle';

i18n.addResourceBundle('en', NAMESPACE, {
  risk: 'Risk',
  lines: 'Lines',
  showRiskLayer: 'Show risk layer',
  hideRiskLayer: 'Show line colours instead of risk',
  riskLow: 'Low',
  riskHigh: 'High',
});

i18n.addResourceBundle('de', NAMESPACE, {
  risk: 'Risiko',
  lines: 'Linien',
  showRiskLayer: 'Risiko-Ebene anzeigen',
  hideRiskLayer: 'Linienfarben statt Risiko anzeigen',
  riskLow: 'Gering',
  riskHigh: 'Hoch',
});
