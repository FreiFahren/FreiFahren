import { Camera, Check, LoaderCircle, Plus } from 'lucide-react';
import { useRef, useState, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { PRIMARY_BUTTON } from '@/components/account/account-layout';
import { Button } from '@/components/ui/button';
import { useFineUpload } from '@/hooks/use-fine-upload';
import { FundRequestError } from '@/lib/fund-api';

import { FundRulesDialog } from './fund-rules';
import { NAMESPACE } from './fund.i18n';

const UPLOAD_ERRORS = {
  400: 'uploadEmpty',
  401: 'uploadSessionExpired',
  403: 'uploadMembershipEnded',
  413: 'uploadTooLarge',
  415: 'uploadWrongType',
  503: 'uploadUnavailable',
} as const;

type FineUploadProps = {
  userId: string;
  sessionId: string;
  onSignIn: () => void;
  floating: boolean;
};

export function FineUpload({ userId, sessionId, onSignIn, floating }: FineUploadProps) {
  const { t } = useTranslation(NAMESPACE);
  const camera = useRef<HTMLInputElement>(null);
  const upload = useFineUpload(userId, sessionId);
  const [showRules, setShowRules] = useState(false);

  const confirmPhoto = () => {
    setShowRules(false);
    // Keep this synchronous: mobile browsers require the approval's user gesture for the picker.
    camera.current?.click();
  };

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

  // Ordered first while floating so upload status shows above a long history, without remounting
  // (and losing the upload's state) when the first upload fills the history.
  return (
    <section aria-label={t('uploadTitle')} className={floating ? 'order-first' : 'mt-6 space-y-4'}>
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
      {floating ? (
        <div className="pb-safe-3 pointer-events-none fixed right-0 bottom-0 z-20 px-3 pt-3">
          <FundRulesDialog open={showRules} onOpenChange={setShowRules} onConfirm={confirmPhoto}>
            <Button
              type="button"
              size="icon"
              aria-label={t('uploadTitle')}
              className="bg-accent-bright text-primary-foreground hover:bg-accent-press pointer-events-auto size-14 rounded-lg shadow-[0_6px_16px_rgba(214,59,59,0.28)] [&_svg:not([class*='size-'])]:size-6"
              disabled={upload.isPending}
            >
              <Plus aria-hidden="true" />
            </Button>
          </FundRulesDialog>
        </div>
      ) : (
        <FundRulesDialog open={showRules} onOpenChange={setShowRules} onConfirm={confirmPhoto}>
          <Button
            type="button"
            size="lg"
            className={`${PRIMARY_BUTTON} mx-auto flex max-w-xs gap-3`}
            disabled={upload.isPending}
          >
            <Camera className="size-5" aria-hidden="true" />
            {t('uploadTitle')}
          </Button>
        </FundRulesDialog>
      )}
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
