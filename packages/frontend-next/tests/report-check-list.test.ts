import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
vi.mock('../src/components/report/ReportForm.i18n', () => ({ NAMESPACE: 'report' }));

import { ReportCheckList } from '../src/components/report/report-check-list';
import type { VerificationChecks } from '../src/components/report/report-verification';

const checks: VerificationChecks = {
  location: { status: 'passed' },
  device: { status: 'unavailable' },
  activity: { status: 'passed' },
};

describe('Report check presentation', () => {
  it('silently omits an unavailable spam check', () => {
    const html = renderToStaticMarkup(createElement(ReportCheckList, { checks }));
    expect(html).not.toContain('data-check="device"');
    expect(html).not.toContain('device_unavailable');
    expect(html).not.toContain('status_unavailable');
    expect(html).toContain('data-check="location"');
    expect(html).toContain('data-check="activity"');
  });

  it('continues to show completed spam checks and actionable location failures', () => {
    const html = renderToStaticMarkup(
      createElement(ReportCheckList, {
        checks: {
          ...checks,
          device: { status: 'passed' },
          location: { status: 'failed', reason: 'too_far' },
        },
      }),
    );
    expect(html).toContain('device_passed');
    expect(html).toContain('reason_too_far');
  });
});
