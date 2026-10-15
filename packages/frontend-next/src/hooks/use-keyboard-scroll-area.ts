import { useEffect, useRef } from 'react';

export function useKeyboardScrollArea() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const scrollArea = ref.current;
    if (!scrollArea) return;
    const viewport = window.visualViewport;

    const keepFormVisible = () => {
      const focused = document.activeElement;
      if (!(focused instanceof HTMLElement) || !scrollArea.contains(focused)) return;
      if (!focused.matches('input, textarea, select, [contenteditable="true"]')) return;

      const bounds = scrollArea.getBoundingClientRect();
      const top = Math.max(bounds.top, viewport?.offsetTop ?? 0);
      const bottom = Math.min(
        bounds.bottom,
        (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
      );
      const form = focused.closest('form');
      const target =
        form && form.getBoundingClientRect().height <= bottom - top - 32 ? form : focused;
      const targetBounds = target.getBoundingClientRect();
      if (targetBounds.bottom > bottom - 16) {
        scrollArea.scrollTop += targetBounds.bottom - bottom + 16;
      } else if (targetBounds.top < top + 16) {
        scrollArea.scrollTop += targetBounds.top - top - 16;
      }
    };

    const updateBrowserInset = () => {
      // Mobile browsers can shrink the visible viewport while leaving the fixed page full-height.
      const inset = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
      scrollArea.style.setProperty('--browser-keyboard-inset', `${inset}px`);
      keepFormVisible();
    };

    const observer = new ResizeObserver(keepFormVisible);
    observer.observe(scrollArea);
    scrollArea.addEventListener('focusin', keepFormVisible);
    viewport?.addEventListener('resize', updateBrowserInset);
    viewport?.addEventListener('scroll', updateBrowserInset);
    window.addEventListener('resize', updateBrowserInset);
    updateBrowserInset();

    return () => {
      observer.disconnect();
      scrollArea.removeEventListener('focusin', keepFormVisible);
      viewport?.removeEventListener('resize', updateBrowserInset);
      viewport?.removeEventListener('scroll', updateBrowserInset);
      window.removeEventListener('resize', updateBrowserInset);
      scrollArea.style.removeProperty('--browser-keyboard-inset');
    };
  }, []);

  return ref;
}
