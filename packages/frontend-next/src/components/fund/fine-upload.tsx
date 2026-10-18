import { Check, LoaderCircle, Plus } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { useFineUpload } from '@/hooks/use-fine-upload';
import { FundRequestError } from '@/lib/fund-api';

import { NAMESPACE } from './fund.i18n';

const UPLOAD_ERRORS = {
  400: 'uploadEmpty',
  401: 'uploadSessionExpired',
  413: 'uploadTooLarge',
  415: 'uploadWrongType',
  503: 'uploadUnavailable',
} as const;

type FineUploadProps = {
  userId: string;
  sessionId: string;
  onSignIn: () => void;
};

export function FineUpload({ userId, sessionId, onSignIn }: FineUploadProps) {
  const { t } = useTranslation(NAMESPACE);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useFineUpload(userId, sessionId);

  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file && !upload.isPending) upload.mutate(file);
  };

  let errorKey = 'uploadInterrupted';
  let needsSignIn = false;
  let canRetry = upload.isError;
  if (upload.error instanceof FundRequestError) {
    errorKey =
      UPLOAD_ERRORS[upload.error.status as keyof typeof UPLOAD_ERRORS] ?? 'uploadInterrupted';
    needsSignIn = upload.error.status === 401;
    canRetry = upload.error.status >= 500;
  }

  return (
    <section aria-label={t('uploadTitle')}>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        aria-label={t('takePhoto')}
        onChange={selectPhoto}
        disabled={upload.isPending}
      />
      <div className="pb-safe-3 pointer-events-none fixed right-0 bottom-0 z-20 px-3 pt-3">
        <Button
          type="button"
          size="icon"
          aria-label={t('takePhoto')}
          className="bg-accent-bright text-primary-foreground hover:bg-accent-press pointer-events-auto size-14 rounded-lg shadow-[0_6px_16px_rgba(214,59,59,0.28)] [&_svg:not([class*='size-'])]:size-6"
          onClick={() => camera.current?.click()}
          disabled={upload.isPending}
        >
          <Plus aria-hidden="true" />
        </Button>
      </div>
      {upload.isPending && (
        <p role="status" className="text-muted-foreground mb-4 flex items-center gap-2 text-sm">
          <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
          {t('uploadingPhoto')}
        </p>
      )}
      {upload.isSuccess && (
        <p role="status" className="mb-4 flex items-start gap-2 text-sm">
          <Check className="text-ok mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {t('uploadSuccess')}
        </p>
      )}
      {upload.isError && (
        <div role="alert" className="mb-4 space-y-2 text-sm">
          <p className="text-destructive">{t(errorKey)}</p>
          {needsSignIn && (
            <Button variant="outline" onClick={onSignIn}>
              {t('uploadSignIn')}
            </Button>
          )}
          {canRetry && upload.variables && (
            <Button variant="outline" onClick={() => upload.mutate(upload.variables!)}>
              {t('retry')}
            </Button>
          )}
        </div>
      )}
    </section>
  );
}
