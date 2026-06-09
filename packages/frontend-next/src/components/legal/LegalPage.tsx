import { useNavigate } from '@tanstack/react-router';
import type { ReactNode } from 'react';

import { PageHeader } from '@/components/templates/PageHeader';

// Shared chrome + typographic styling for the legal documents. Child selectors style the plain
// semantic markup (sections/headings/lists) the content components emit, so each page stays a flat
// list of <section>s without repeating Tailwind classes on every element.
const ARTICLE_CLASS = [
  'min-h-0 flex-1 overflow-y-auto px-4 pt-1 pb-10 text-sm leading-relaxed text-muted-foreground',
  '[&_section]:mt-6 [&_section:first-child]:mt-0 [&_section]:space-y-2',
  '[&_h2]:text-foreground [&_h2]:text-base [&_h2]:font-semibold',
  '[&_h3]:text-foreground [&_h3]:font-semibold [&_h3]:pt-1',
  '[&_ul]:list-disc [&_ul]:space-y-1 [&_ul]:pl-5 [&_li]:marker:text-muted-foreground',
  '[&_a]:text-foreground [&_a]:break-words [&_a]:underline',
].join(' ');

type LegalPageProps = {
  title: string;
  children: ReactNode;
};

export function LegalPage({ title, children }: LegalPageProps) {
  const navigate = useNavigate();

  return (
    <div className="bg-card animate-in fade-in fixed inset-0 z-30 duration-150">
      <div className="mx-auto flex h-full w-full max-w-md flex-col">
        <PageHeader title={title} onBack={() => navigate({ to: '/' })} />
        <article className={ARTICLE_CLASS}>{children}</article>
      </div>
    </div>
  );
}
