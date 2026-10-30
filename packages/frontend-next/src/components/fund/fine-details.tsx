import { useNavigate } from '@tanstack/react-router';
import { LoaderCircle, Mail, Upload } from 'lucide-react';
import { useRef, type ChangeEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { SignInGate } from '@/components/account/sign-in-gate';
import { FullScreenPage } from '@/components/templates/full-screen-page';
import { PageHeader } from '@/components/templates/PageHeader';
import { Button } from '@/components/ui/button';
import { useFineDetails } from '@/hooks/use-fine-details';
import { useFineUpload } from '@/hooks/use-fine-upload';
import { useFundEnabled } from '@/hooks/use-fund-enabled';
import { useKeyboardScrollArea } from '@/hooks/use-keyboard-scroll-area';
import { FundRequestError, type Fine } from '@/lib/fund-api';
import { Route as FundRoute } from '@/routes/fund/index';

import { FineStatus } from './fine-status';
import { FineUploadHistory } from './fine-upload-history';
import { NAMESPACE } from './fund.i18n';

type FineDetailsProps = {
  userId: string;
  sessionId: string;
  fineId: string;
  onSignIn: () => void;
};

export function FineDetailsPage({ fineId }: { fineId: string }) {
  const { t } = useTranslation(NAMESPACE);
  const navigate = useNavigate();
  const enabled = useFundEnabled();
  const scrollAreaRef = useKeyboardScrollArea();

  return (
    <FullScreenPage>
      <PageHeader
        title={t('fineDetailsTitle')}
        onBack={() => void navigate({ to: FundRoute.to })}
      />
      <div
        ref={scrollAreaRef}
        className="pb-safe-6 mb-[max(var(--keyboard-inset),var(--browser-keyboard-inset,0px))] min-h-0 flex-1 overflow-y-auto px-4 pt-4"
      >
        {enabled && (
          <SignInGate>
            {({ user, session }, refetch) => (
              <div key={`${session.id}-${fineId}`} className="space-y-6">
                <FineDetailsContent
                  userId={user.id}
                  sessionId={session.id}
                  fineId={fineId}
                  onSignIn={refetch}
                />
                <div className="border-border border-t pt-4 text-sm">
                  <p className="text-muted-foreground mb-2">{t('fineSupportHelp')}</p>
                  <a
                    className="inline-flex items-center gap-2 underline underline-offset-4 hover:opacity-80"
                    href={`mailto:support@freifahren.org?subject=${encodeURIComponent(`FreiFahren Fund · ${fineId}`)}`}
                  >
                    <Mail className="size-4" aria-hidden="true" /> support@freifahren.org
                  </a>
                </div>
              </div>
            )}
          </SignInGate>
        )}
      </div>
    </FullScreenPage>
  );
}

function FineDetailsContent({ userId, sessionId, fineId, onSignIn }: FineDetailsProps) {
  const { t } = useTranslation(NAMESPACE);
  const details = useFineDetails(userId, sessionId, fineId);
  if (details.isPending) return <p role="status">{t('loadingFineDetails')}</p>;
  if (details.error instanceof FundRequestError && [400, 404].includes(details.error.status))
    return (
      <p role="alert" className="text-sm">
        {t('fineNotFound')}
      </p>
    );
  if (details.error instanceof FundRequestError && details.error.status === 401)
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>{t('uploadSessionExpired')}</p>
        <Button variant="outline" onClick={onSignIn}>
          {t('uploadSignIn')}
        </Button>
      </div>
    );
  if (details.isError)
    return (
      <div role="alert" className="space-y-3 text-sm">
        <p>{t('fineDetailsError')}</p>
        <Button variant="outline" onClick={() => void details.refetch()}>
          {t('retry')}
        </Button>
      </div>
    );

  const fine = details.data;
  return (
    <>
      <dl className="space-y-3 text-sm">
        <div>
          <dt className="text-muted-foreground mb-1">{t('status')}</dt>
          <dd>
            <FineStatus status={fine.status} paidAt={fine.paidAt} showTime />
          </dd>
        </div>
        <div>
          <dt className="text-muted-foreground">{t('fineReference')}</dt>
          <dd className="font-mono text-xs break-all">{fine.id}</dd>
        </div>
      </dl>
      <FineUploadHistory fineId={fine.id} uploads={fine.uploads} />
      <ReuploadFine userId={userId} sessionId={sessionId} fine={fine} onSignIn={onSignIn} />
    </>
  );
}

function ReuploadFine({
  userId,
  sessionId,
  fine,
  onSignIn,
}: {
  userId: string;
  sessionId: string;
  fine: Fine;
  onSignIn: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);
  const input = useRef<HTMLInputElement>(null);
  const upload = useFineUpload(userId, sessionId, fine.id);
  const selectPhoto = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = '';
    if (file && !upload.isPending) upload.mutate(file);
  };
  if (upload.isSuccess && fine.status !== 'declined')
    return (
      <p role="status" className="text-ok text-sm">
        {t('reuploadSuccess')}
      </p>
    );
  if (fine.status !== 'declined') return null;
  let errorKey = 'reuploadInterrupted';
  if (upload.error instanceof FundRequestError) {
    const errors = {
      400: 'uploadEmpty',
      401: 'uploadSessionExpired',
      404: 'fineDetailsError',
      409: 'reuploadConflict',
      413: 'uploadTooLarge',
      415: 'uploadWrongType',
      503: 'uploadUnavailable',
    } as const;
    errorKey = errors[upload.error.status as keyof typeof errors] ?? errorKey;
  }
  return (
    <section className="border-border space-y-3 border-t pt-4" aria-label={t('reuploadFine')}>
      <p className="text-muted-foreground text-sm">{t('reuploadExplanation')}</p>
      <input
        ref={input}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
        capture="environment"
        className="hidden"
        aria-label={t('reuploadFine')}
        onChange={selectPhoto}
        disabled={upload.isPending}
      />
      <Button
        variant="outline"
        className="w-full"
        disabled={upload.isPending}
        onClick={() => input.current?.click()}
      >
        {upload.isPending && <LoaderCircle className="animate-spin" aria-hidden="true" />}
        {!upload.isPending && <Upload aria-hidden="true" />}
        {t(upload.isPending ? 'uploadingPhoto' : 'reuploadFine')}
      </Button>
      {upload.isError && (
        <p role="alert" className="text-destructive text-sm">
          {t(errorKey)}
        </p>
      )}
      {upload.error instanceof FundRequestError && upload.error.status === 401 && (
        <Button variant="outline" onClick={onSignIn}>
          {t('uploadSignIn')}
        </Button>
      )}
    </section>
  );
}
