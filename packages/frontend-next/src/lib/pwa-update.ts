export const PWA_UPDATE_AVAILABLE_EVENT = 'freifahren:pwa-update-available';

type UpdateServiceWorker = (reloadPage?: boolean) => Promise<void>;
type PwaUpdateListener = () => void;

let updateServiceWorker: UpdateServiceWorker | null = null;
let updateAvailable = false;

export function setPwaUpdateServiceWorker(updater: UpdateServiceWorker): void {
  updateServiceWorker = updater;
}

export function notifyPwaUpdateAvailable(): void {
  updateAvailable = true;
  window.dispatchEvent(new Event(PWA_UPDATE_AVAILABLE_EVENT));
}

export function subscribePwaUpdate(listener: PwaUpdateListener): () => void {
  const onUpdate = () => {
    updateAvailable = true;
    listener();
  };
  window.addEventListener(PWA_UPDATE_AVAILABLE_EVENT, onUpdate);
  return () => window.removeEventListener(PWA_UPDATE_AVAILABLE_EVENT, onUpdate);
}

export function hasPwaUpdateAvailable(): boolean {
  return updateAvailable;
}

export async function applyPwaUpdate(): Promise<void> {
  await updateServiceWorker?.(true);
}
