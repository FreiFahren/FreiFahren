import { createFileRoute, redirect } from '@tanstack/react-router';

import { ReportDecayDebugPanel } from '@/components/debug/ReportDecayDebugPanel';

export const Route = createFileRoute('/_map/debug/report-decay')({
  staticData: { legalDisclaimer: false },
  beforeLoad: () => {
    if (!import.meta.env.DEV) throw redirect({ to: '/', replace: true });
  },
  component: ReportDecayDebugPanel,
});
