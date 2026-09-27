import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/announcements/announcements.i18n';
import {
  ANNOUNCEMENT_PULSE_MS,
  useAnnouncementBurst,
  useHasUnreadAnnouncements,
} from '@/components/announcements/use-announcements';
import { Button } from '@/components/ui/button';
import { PulseDot } from '@/components/ui/pulse-dot';
import { track } from '@/lib/analytics';
import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { useOnboardingComplete } from '@/lib/onboarding';
import { Route as AnnouncementsRoute } from '@/routes/announcements/index';

// Only the entry point is flagged: the routes stay reachable, so a shared link works for everyone.
export function AnnouncementsButton() {
  return useFeatureFlag(FEATURE_FLAGS.announcements) ? <BellButton /> : null;
}

// Separate so the list is only fetched once the flag is on.
function BellButton() {
  const { t } = useTranslation(NAMESPACE);
  const unread = useHasUnreadAnnouncements();

  return (
    <Button
      asChild
      variant="secondary"
      size="icon"
      aria-label={unread ? t('openUnread') : t('open')}
      className="bg-card text-foreground hover:bg-card/80 pointer-events-auto relative size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <Link
        to={AnnouncementsRoute.to}
        onClick={() => track('announcements_bell_clicked', { has_unread: unread })}
      >
        {unread ? <UnreadBellIcon /> : <Bell className="size-5" />}
      </Link>
    </Button>
  );
}

// Mounted only while something is unread, so the first burst plays as soon as the unread state arrives.
function UnreadBellIcon() {
  const ringing = useAnnouncementBurst(useOnboardingComplete());
  return (
    <>
      <Bell
        className={ringing ? 'motion-safe:animate-bell-ring size-5' : 'size-5'}
        style={{ '--ring-cycle': `${ANNOUNCEMENT_PULSE_MS}ms` } as React.CSSProperties}
      />
      <PulseDot
        cycleMs={ANNOUNCEMENT_PULSE_MS}
        pulse={ringing}
        className="absolute top-2 right-2 size-2.5"
      />
    </>
  );
}
