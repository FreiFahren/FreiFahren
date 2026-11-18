import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@freifahren/ui/button';
import { cn } from '@freifahren/ui/cn';
import { Separator } from '@freifahren/ui/separator';
import { Route as MapIndexRoute } from '@/routes/_map/index';

import { NAMESPACE } from './PageHeader.i18n';
import { PageBreadcrumbs, type PageBreadcrumb } from './page-breadcrumbs';

type PageHeaderProps = {
  title: string;
  onBack?: () => void;
  reserveBackSpace?: boolean;
  breadcrumbs?: PageBreadcrumb[];
  /** Optional trailing content, right-aligned in the header (e.g. a feedback button). */
  action?: React.ReactNode;
};

export function PageHeader({
  title,
  onBack,
  reserveBackSpace,
  breadcrumbs,
  action,
}: PageHeaderProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <>
      <header className="pt-safe-6 flex items-center gap-2 px-4">
        {breadcrumbs ? (
          <>
            <h1 className="sr-only">{title}</h1>
            <PageBreadcrumbs
              parents={[{ label: t('map'), to: MapIndexRoute.to }, ...breadcrumbs]}
              title={title}
            />
          </>
        ) : (
          <>
            {(onBack || reserveBackSpace) && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onBack}
                aria-label={t('back')}
                disabled={!onBack}
                className={cn('-ml-2', !onBack && 'invisible')}
              >
                {/* ml-2 cancels the icon button's optical inset so the chevron lines up with the page's px-4 content edge */}
                <ChevronLeft className="size-5" />{' '}
              </Button>
            )}
            <h1 className="font-heading text-lg font-semibold">{title}</h1>
          </>
        )}
        {action && <div className="-mr-2 ml-auto">{action}</div>}
      </header>
      <Separator className="my-2" />
    </>
  );
}
