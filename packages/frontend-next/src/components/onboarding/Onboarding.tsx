import { useRouterState } from '@tanstack/react-router';

import { Card } from '@/components/ui/card';
import { useCurrentOnboardingStep } from '@/lib/onboarding';

/**
 * First-run onboarding modal for the current outstanding step. Hidden on routes without
 * `staticData.legalDisclaimer` so the imprint/privacy links inside the legal step stay reachable.
 */
export function Onboarding() {
  const step = useCurrentOnboardingStep();
  const applicable = useRouterState({
    select: (state) => state.matches.at(-1)?.staticData.legalDisclaimer ?? false,
  });

  if (step === 'pending' || step === null || !applicable) return null;

  const { Screen } = step;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="onboarding-step-title"
      className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 duration-150"
    >
      {/* min-h keeps steps a consistent size so the card doesn't resize between them. */}
      <Card className="animate-in zoom-in-95 fade-in shadow-2 relative z-10 max-h-[85vh] min-h-[26rem] w-full max-w-md duration-200">
        <Screen />
      </Card>
    </div>
  );
}
