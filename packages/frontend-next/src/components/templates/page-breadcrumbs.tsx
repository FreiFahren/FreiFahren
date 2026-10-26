import { Link, type LinkProps } from '@tanstack/react-router';
import { Fragment } from 'react';
import { useTranslation } from 'react-i18next';

import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb';

import { NAMESPACE } from './PageHeader.i18n';

export type PageBreadcrumb = {
  label: string;
  to: NonNullable<LinkProps['to']>;
};

export function PageBreadcrumbs({ parents, title }: { parents: PageBreadcrumb[]; title: string }) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <Breadcrumb aria-label={t('breadcrumb')} className="min-w-0 flex-1">
      <BreadcrumbList className="min-h-8 flex-nowrap gap-2 text-sm">
        {parents.map(({ label, to }) => (
          <Fragment key={to}>
            <BreadcrumbItem className="shrink-0">
              <BreadcrumbLink
                asChild
                className="focus-visible:ring-ring inline-flex min-h-8 items-center rounded-sm outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
              >
                <Link to={to} activeOptions={{ exact: true }}>
                  {label}
                </Link>
              </BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator className="shrink-0" />
          </Fragment>
        ))}
        <BreadcrumbItem className="min-w-0">
          <BreadcrumbPage
            title={title}
            className="line-clamp-2 font-medium [overflow-wrap:anywhere]"
          >
            {title}
          </BreadcrumbPage>
        </BreadcrumbItem>
      </BreadcrumbList>
    </Breadcrumb>
  );
}
