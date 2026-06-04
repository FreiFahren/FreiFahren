import { Toaster as Sonner, type ToasterProps } from 'sonner';

// Dark-only app, so theme is fixed rather than read from next-themes like the stock component.
const Toaster = ({ ...props }: ToasterProps) => (
  <Sonner
    theme="dark"
    className="toaster group"
    position="top-center"
    offset="4.5rem"
    mobileOffset="4.5rem"
    style={
      {
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
      } as React.CSSProperties
    }
    {...props}
  />
);

export { Toaster };
