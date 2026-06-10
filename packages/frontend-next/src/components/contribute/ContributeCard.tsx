import { Check, Copy, HeartHandshake } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import { DetailCard } from '@/components/map/DetailCard';
import { Button } from '@/components/ui/button';
import { CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  closeContributeModal,
  dismissContributeForever,
  useContributeModalOpen,
} from '@/lib/contribute-modal';
import { optionalEnv } from '@/lib/utils';

import { NAMESPACE } from './ContributeCard.i18n';

const BANK_HOLDER = 'FreiFahren e.V.';
const BANK_IBAN = 'DE73 8306 5408 0007 0044 60';
const BANK_BIC = 'GENODEF1SLR';

const stripePaymentLink = optionalEnv('VITE_STRIPE_PAYMENT_LINK');
const hasStripeConfig = Boolean(stripePaymentLink);

type BankFieldId = 'holder' | 'iban' | 'bic' | 'reference';

export function ContributeCard() {
  const open = useContributeModalOpen();
  if (!open) return null;
  return <ContributeCardContent />;
}

function ContributeCardContent() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <DetailCard title={t('title')} closeLabel={t('close')} onClose={closeContributeModal}>
      <CardContent className="flex flex-col gap-4">
        <p className="text-muted-foreground text-sm">{t('description')}</p>

        {hasStripeConfig ? (
          <Tabs defaultValue="stripe" className="gap-4">
            <TabsList className="bg-surface-solid border-border grid w-full grid-cols-2 gap-0.5 rounded-md border p-0.5">
              <TabsTrigger value="stripe" className={triggerClass}>
                {t('tabStripe')}
              </TabsTrigger>
              <TabsTrigger value="bank" className={triggerClass}>
                {t('tabBank')}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="stripe">
              <StripeTab />
            </TabsContent>
            <TabsContent value="bank">
              <BankTab />
            </TabsContent>
          </Tabs>
        ) : (
          <BankTab />
        )}

        <Button
          variant="link"
          size="sm"
          onClick={dismissContributeForever}
          className="text-muted-foreground hover:text-foreground self-center text-xs"
        >
          {t('dismiss')}
        </Button>
      </CardContent>
    </DetailCard>
  );
}

const triggerClass =
  'text-muted-foreground data-[state=active]:bg-surface-elev data-[state=active]:text-foreground rounded-sm py-1.5 text-xs font-semibold tracking-wide uppercase';

function StripeTab() {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div className="flex flex-col items-center gap-3 py-2 text-center">
      <p className="text-muted-foreground text-sm">{t('stripeNote')}</p>
      <Button
        asChild
        size="lg"
        className="bg-accent-bright text-primary-foreground hover:bg-accent-press h-11 w-full gap-2"
      >
        <a href={stripePaymentLink} target="_blank" rel="noopener noreferrer">
          <HeartHandshake />
          {t('support')}
        </a>
      </Button>
    </div>
  );
}

function BankTab() {
  const { t } = useTranslation(NAMESPACE);
  const [copiedFieldId, setCopiedFieldId] = useState<BankFieldId | null>(null);

  const rows: { id: BankFieldId; label: string; value: string }[] = [
    { id: 'holder', label: t('bankHolder'), value: BANK_HOLDER },
    { id: 'iban', label: 'IBAN', value: BANK_IBAN },
    { id: 'bic', label: 'BIC', value: BANK_BIC },
    { id: 'reference', label: t('bankReference'), value: t('bankReferenceValue') },
  ];

  const copy = async (fieldId: BankFieldId, value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedFieldId(fieldId);
      window.setTimeout(() => setCopiedFieldId(null), 2000);
    } catch {
      setCopiedFieldId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      {rows.map((row) => {
        const copied = copiedFieldId === row.id;
        return (
          <div
            key={row.id}
            className="border-border flex items-center justify-between gap-3 rounded-md border px-3 py-2"
          >
            <div className="min-w-0">
              <p className="text-muted-foreground text-xs">{row.label}</p>
              <p className="truncate text-sm font-semibold">{row.value}</p>
            </div>
            <Button
              variant="ghost"
              size="icon-sm"
              onClick={() => copy(row.id, row.value)}
              aria-label={`${copied ? t('copied') : t('copy')}: ${row.label}`}
              className="text-muted-foreground shrink-0"
            >
              {copied ? <Check className="text-ok" /> : <Copy />}
            </Button>
          </div>
        );
      })}
    </div>
  );
}
