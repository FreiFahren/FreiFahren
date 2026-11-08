import { useMutation } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { fetchFund } from '@/lib/fund-api';

import { NAMESPACE } from './fund.i18n';

export function TransferReceipt({ path }: { path: string }) {
  const { t } = useTranslation(NAMESPACE);
  const [url, setUrl] = useState<string | null>(null);
  const receipt = useMutation({
    mutationFn: async () => (await fetchFund(path)).blob(),
    gcTime: 0,
  });

  useEffect(() => {
    if (url) return () => URL.revokeObjectURL(url);
  }, [url]);

  let buttonLabel = t('viewTransferReceipt');
  if (receipt.isPending) buttonLabel = t('loadingTransferReceipt');

  return (
    <div>
      {!url && (
        <button
          className="text-sm underline"
          disabled={receipt.isPending}
          onClick={() =>
            receipt.mutate(undefined, {
              onSuccess: (blob) => setUrl(URL.createObjectURL(blob)),
            })
          }
        >
          {buttonLabel}
        </button>
      )}
      {url && (
        <>
          <a className="text-sm underline" href={url} target="_blank" rel="noopener noreferrer">
            {t('viewTransferReceipt')}
          </a>
          <iframe
            title={t('viewTransferReceipt')}
            src={url}
            className="mt-2 h-96 w-full rounded border"
          />
        </>
      )}
      {receipt.isError && (
        <p role="alert" className="text-sm">
          {t('transferReceiptError')}
        </p>
      )}
    </div>
  );
}
