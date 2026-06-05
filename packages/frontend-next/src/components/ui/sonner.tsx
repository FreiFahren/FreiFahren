import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Dark-only app, so theme is fixed rather than read from next-themes like the stock component.
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group"
    position="top-center"
    offset="4.5rem"
    mobileOffset="4.5rem"
    // `unstyled` toasts lose sonner's `width: var(--width)`, so the <li> shrinks to content
    // and pins to the left edge of the centered toaster box on desktop. Force full width so the
    // pill's `mx-auto` can center it (mobile already sets this via sonner's own media query).
    toastOptions={{ className: 'flex w-full justify-center' }}
    style={
      {
        // Keep toasts below the search results (z-30) but above the map controls (z-20);
        // sonner otherwise defaults to a z-index of 999999, which covers the dropdown.
        zIndex: 25,
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
