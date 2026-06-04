import { createFileRoute, useNavigate } from '@tanstack/react-router';

import { PageHeader } from '@/components/templates/PageHeader';

export const Route = createFileRoute('/privacy')({
  staticData: { legalDisclaimer: false },
  component: PrivacyPage,
});

function PrivacyPage() {
  const navigate = useNavigate();

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader title="Privacy" onBack={() => navigate({ to: '/' })} />
        <div className="text-muted-foreground min-h-0 flex-1 overflow-y-auto px-4 text-sm">
          {/* Placeholder — real privacy policy content to be added. */}
          <p>Privacy policy coming soon.</p>
        </div>
      </div>
    </div>
  );
}
