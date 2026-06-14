import { GithubIcon, InstagramIcon } from '@/components/brand-icons';
import { Button } from '@/components/ui/button';
import { cn, optionalEnv } from '@/lib/utils';

const GITHUB_URL = optionalEnv('VITE_GITHUB_URL') ?? 'https://github.com/FreiFahren/FreiFahren';
const INSTAGRAM_URL = optionalEnv('VITE_INSTAGRAM_URL') ?? 'https://www.instagram.com/frei.fahren';

// Two appearances: 'floating' for map overlays (needs its own card background + shadow to read over
// the map) and 'inline' for use inside an existing card (plain ghost buttons, like in settings).
const APPEARANCE_CLASS = {
  floating:
    'bg-card text-card-foreground hover:bg-card/80 pointer-events-auto size-8 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]',
  inline: 'text-muted-foreground hover:text-foreground',
} as const;

type SocialLinksProps = {
  className?: string;
  appearance?: keyof typeof APPEARANCE_CLASS;
};

// Small GitHub + Instagram icon buttons reused on the map (above the reports-overview button and
// inside the report card). Layout (row vs column) is left to the caller via className.
export function SocialLinks({ className, appearance = 'floating' }: SocialLinksProps) {
  const buttonClass = APPEARANCE_CLASS[appearance];
  return (
    <div className={cn('flex gap-1.5', className)}>
      <Button
        asChild
        variant="secondary"
        size="icon-sm"
        aria-label="GitHub"
        className={buttonClass}
      >
        <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
          <GithubIcon />
        </a>
      </Button>
      <Button
        asChild
        variant="secondary"
        size="icon-sm"
        aria-label="Instagram"
        className={buttonClass}
      >
        <a href={INSTAGRAM_URL} target="_blank" rel="noopener noreferrer">
          <InstagramIcon />
        </a>
      </Button>
    </div>
  );
}
