import { useTranslation } from 'react-i18next';
import { Button } from '@freifahren/ui/button';
import { cn } from '@freifahren/ui/cn';
import { NAMESPACE } from './ReportForm.i18n';

export function ReportActionFooter({
  label,
  onClick,
  inactive = false,
  showDisclaimer = false,
}: {
  label?: string;
  onClick?: () => void;
  inactive?: boolean;
  showDisclaimer?: boolean;
}) {
  const { t } = useTranslation(NAMESPACE);
  // Reserve the translated caption’s height on both screens, including when it wraps.
  return (
    <footer className="bg-card pb-safe-4 sticky bottom-0 mt-auto shrink-0 px-4 pt-6">
      {onClick && (
        <Button
          type="button"
          size="lg"
          aria-disabled={inactive}
          onClick={onClick}
          className={cn(
            'h-12 w-full rounded-lg text-base font-semibold',
            !inactive
              ? 'bg-accent-bright text-primary-foreground hover:bg-accent-press shadow-[0_6px_16px_rgba(214,59,59,0.28)]'
              : 'bg-surface-solid text-muted-foreground border-border border',
          )}
        >
          {label}
        </Button>
      )}
      <div className="text-muted-foreground mt-2 grid text-center text-[0.6875rem]">
        {(['disclaimer', 'checkPrivacy'] as const).map((key) => (
          <p
            key={key}
            className={cn(
              'col-start-1 row-start-1',
              showDisclaimer !== (key === 'disclaimer') && 'invisible',
            )}
          >
            {t(key)}
          </p>
        ))}
      </div>
    </footer>
  );
}
