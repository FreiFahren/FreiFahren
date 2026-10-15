import { Camera, Heart, ShieldCheck } from 'lucide-react';
import type { ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { Separator } from '@/components/ui/separator';

import { NAMESPACE } from './fund.i18n';

const STEPS = [
  { icon: Camera, title: 'photoTitle' },
  { icon: ShieldCheck, title: 'paymentTitle' },
  { icon: Heart, title: 'freeTitle' },
] as const;

export function FundIntroduction({ children }: { children: ReactNode }) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="flex flex-col gap-5 pb-2">
      <h2 className="font-heading text-xl leading-snug font-semibold text-balance">
        {t('headline')}
      </h2>
      <ul className="flex flex-col gap-3">
        {STEPS.map(({ icon: Icon, title }) => (
          <li key={title} className="flex items-center gap-3">
            <div className="bg-muted flex size-8 shrink-0 items-center justify-center rounded-lg">
              <Icon aria-hidden="true" className="size-4" />
            </div>
            <h3 className="font-heading min-w-0 text-sm font-semibold">{t(title)}</h3>
          </li>
        ))}
      </ul>
      <Separator />
      {children}
    </div>
  );
}
