import { cn } from '@/lib/utils';

const isIosSafari =
  !__CAPACITOR__ &&
  typeof navigator !== 'undefined' &&
  (/iPhone|iPad|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) &&
  /Safari\//.test(navigator.userAgent) &&
  !/CriOS|FxiOS|EdgiOS|OPiOS/.test(navigator.userAgent);

/** Safari samples page edges for its chrome, including when browser safe-area insets are zero. */
export function SafeAreaBackground() {
  return (
    <>
      <div
        aria-hidden="true"
        data-slot="safe-area-background"
        data-edge="top"
        className={cn(
          'bg-card pointer-events-none fixed inset-x-0 top-0 z-50 h-[env(safe-area-inset-top)]',
          isIosSafari && 'min-h-1.5',
        )}
      />
      <div
        aria-hidden="true"
        data-slot="safe-area-background"
        data-edge="bottom"
        className={cn(
          'bg-card pointer-events-none fixed inset-x-0 bottom-0 z-50 h-[env(safe-area-inset-bottom)]',
          isIosSafari && 'min-h-1.5',
        )}
      />
    </>
  );
}
