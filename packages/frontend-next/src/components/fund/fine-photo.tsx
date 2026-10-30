import { Download, Eye, LoaderCircle } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/components/ui/button';
import { FundRequestError, fetchFund, type FineUploadVersion } from '@/lib/fund-api';

import { NAMESPACE } from './fund.i18n';

export function FinePhoto({ fineId, upload }: { fineId: string; upload: FineUploadVersion }) {
  const { t } = useTranslation(NAMESPACE);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorStatus, setErrorStatus] = useState<number | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [extension, setExtension] = useState('');
  const [isUnsupported, setIsUnsupported] = useState(false);
  const request = useRef<AbortController | null>(null);
  const panelId = `fine-photo-${upload.id}`;

  // Prevent a late response from creating an object URL after the component unmounts.
  useEffect(
    () => () => {
      request.current?.abort();
    },
    [],
  );

  // Object URLs retain the image in memory until they are revoked.
  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  const loadPhoto = async () => {
    request.current?.abort();
    const controller = new AbortController();
    request.current = controller;
    setIsOpen(true);
    setIsLoading(true);
    setErrorStatus(null);

    try {
      const response = await fetchFund(
        `/fines/${encodeURIComponent(fineId)}/uploads/${encodeURIComponent(upload.id)}/photo`,
        { signal: controller.signal },
      );
      const blob = await response.blob();
      if (controller.signal.aborted) return;
      setPhotoUrl(URL.createObjectURL(blob));
      setExtension(extensionFor(blob.type));
      setIsUnsupported(false);
    } catch (error) {
      if (!controller.signal.aborted) {
        setErrorStatus(error instanceof FundRequestError ? error.status : 0);
      }
    } finally {
      if (!controller.signal.aborted) {
        request.current = null;
        setIsLoading(false);
      }
    }
  };

  const closePhoto = () => {
    request.current?.abort();
    request.current = null;
    setIsOpen(false);
    setIsLoading(false);
    setErrorStatus(null);
    setPhotoUrl(null);
    setIsUnsupported(false);
  };

  let buttonLabel = 'viewFinePhoto';
  let ButtonIcon = Eye;
  let buttonIconClass: string | undefined;
  if (isLoading) {
    buttonLabel = 'loadingFinePhoto';
    ButtonIcon = LoaderCircle;
    buttonIconClass = 'animate-spin';
  } else if (isOpen) {
    buttonLabel = 'hideFinePhoto';
  }

  return (
    <div className="mt-3 space-y-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        aria-expanded={isOpen}
        aria-controls={panelId}
        disabled={isLoading}
        onClick={() => {
          if (isOpen) closePhoto();
          else void loadPhoto();
        }}
      >
        <ButtonIcon className={buttonIconClass} aria-hidden="true" />
        {t(buttonLabel)}
      </Button>
      {isOpen && (
        <FinePhotoPanel
          id={panelId}
          photoUrl={photoUrl}
          downloadFilename={`fine-${fineId}-upload-${upload.version}${extension}`}
          isLoading={isLoading}
          errorStatus={errorStatus}
          isUnsupported={isUnsupported}
          onRetry={() => void loadPhoto()}
          onUnsupported={() => setIsUnsupported(true)}
        />
      )}
    </div>
  );
}

function FinePhotoPanel({
  id,
  photoUrl,
  downloadFilename,
  isLoading,
  errorStatus,
  isUnsupported,
  onRetry,
  onUnsupported,
}: {
  id: string;
  photoUrl: string | null;
  downloadFilename: string;
  isLoading: boolean;
  errorStatus: number | null;
  isUnsupported: boolean;
  onRetry: () => void;
  onUnsupported: () => void;
}) {
  const { t } = useTranslation(NAMESPACE);

  return (
    <div id={id} className="space-y-2">
      {isLoading && (
        <p role="status" className="text-muted-foreground text-xs">
          {t('loadingFinePhoto')}
        </p>
      )}
      {errorStatus === 404 && (
        <p role="alert" className="text-xs">
          {t('finePhotoUnavailable')}
        </p>
      )}
      {errorStatus !== null && errorStatus !== 404 && (
        <div role="alert" className="space-y-2 text-xs">
          <p>{t('finePhotoError')}</p>
          <Button type="button" variant="outline" size="sm" onClick={onRetry}>
            {t('retry')}
          </Button>
        </div>
      )}
      {photoUrl && isUnsupported && (
        <p role="status" className="text-muted-foreground text-xs">
          {t('finePhotoUnsupported')}
        </p>
      )}
      {photoUrl && !isUnsupported && (
        <div className="bg-muted max-w-full overflow-hidden rounded-md p-2">
          <img
            src={photoUrl}
            alt={t('finePhotoAlt')}
            className="mx-auto max-h-[60vh] max-w-full object-contain"
            onError={onUnsupported}
          />
        </div>
      )}
      {photoUrl && (
        <Button asChild variant="outline" size="sm">
          <a href={photoUrl} download={downloadFilename}>
            <Download aria-hidden="true" />
            {t('downloadFinePhoto')}
          </a>
        </Button>
      )}
    </div>
  );
}

function extensionFor(contentType: string) {
  const extensions: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/webp': '.webp',
    'image/heic': '.heic',
    'image/heif': '.heif',
  };
  return extensions[contentType] ?? '';
}
