import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/announcements/announcements.i18n';
import { Button } from '@/components/ui/button';
import { PulseDot } from '@/components/ui/pulse-dot';
import { track } from '@/lib/analytics';
import { useAnnouncements } from '@/lib/announcements';
import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { selectionTap } from '@/lib/haptics';
import { useUnreadAnnouncementCount } from '@/lib/read-announcements';
import { cn } from '@/lib/utils';
import { Route as AnnouncementsRoute } from '@/routes/announcements/index';

import './announcements-button.css';

// Both keyframes are percentage-based and fire in the same window, so one duration keeps the
// bell's shake and the badge's ring in step.
const NUDGE_CYCLE_MS = 5000;
const NUDGE_STYLE = { animationDuration: `${NUDGE_CYCLE_MS}ms` };

export function AnnouncementsButton() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useFeatureFlag(FEATURE_FLAGS.announcements);
  const announcements = useAnnouncements();
  const unreadCount = useUnreadAnnouncementCount();

  // Nothing shipped yet means the button would open an empty list.
  if (!enabled || announcements.length === 0) return null;

  return (
    <Button
      asChild
      variant="secondary"
      size="icon"
      aria-label={t('open')}
      className="bg-card text-foreground hover:bg-card/80 pointer-events-auto relative size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <Link
        to={AnnouncementsRoute.to}
        onClick={() => {
          selectionTap();
          track('announcements_opened', { unread_count: unreadCount });
        }}
      >
        <Bell
          className={cn('size-5', unreadCount > 0 && 'bell-ring')}
          style={unreadCount > 0 ? NUDGE_STYLE : undefined}
        />
        {unreadCount > 0 && (
          <PulseDot cycleMs={NUDGE_CYCLE_MS} className="absolute -top-1 -right-1 size-3" />
        )}
      </Link>
    </Button>
  );
}
