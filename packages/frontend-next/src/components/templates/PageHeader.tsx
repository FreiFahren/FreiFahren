import { ChevronLeft } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

import { NAMESPACE } from './PageHeader.i18n';

type PageHeaderProps = {
  title: string;
  onBack: () => void;
  /** Optional trailing content, right-aligned in the header (e.g. a feedback button). */
  action?: React.ReactNode;
};

export function PageHeader({ title, onBack, action }: PageHeaderProps) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <>
      <header className="pt-safe-6 flex items-center gap-2 px-4">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={onBack}
          aria-label={t('back')}
          className="-ml-2"
        >
          {/* ml-2 cancels the icon button's optical inset so the chevron lines up with the page's px-4 content edge */}
          <ChevronLeft className="size-5" />{' '}
        </Button>
        <h1 className="font-heading text-lg font-semibold">{title}</h1>
        {action && <div className="-mr-2 ml-auto">{action}</div>}
      </header>
      <Separator className="my-2" />
    </>
  );
}
