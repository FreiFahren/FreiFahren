/**
 * Brand mark tucked into the notch zone of Face-ID iPhones. The notch is a physical cutout, so the
 * mark is hidden in normal use but captured in screenshots (a full-rectangle framebuffer) — branding
 * with no screenshot detection. Native-only; aimed at the notch fleet (iPhone 13/14/mini/16e, etc.).
 */
export function ScreenshotBranding() {
  if (!__CAPACITOR__) return null;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-x-0 top-0 z-50 flex items-center justify-center"
      style={{ height: 'env(safe-area-inset-top)' }}
    >
      <div className="flex items-center gap-1">
        <img src="/pwa-192x192.png" alt="" className="size-4 rounded-[5px]" />
        <span className="text-[11px] leading-none font-semibold tracking-tight text-white">
          FreiFahren
        </span>
      </div>
    </div>
  );
}
