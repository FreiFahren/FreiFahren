import { Link } from '@tanstack/react-router';
import { Bell } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import { NAMESPACE } from '@/components/announcements/announcements.i18n';
import {
  ANNOUNCEMENT_PULSE_MS,
  useHasUnreadAnnouncements,
} from '@/components/announcements/use-announcements';
import { Button } from '@/components/ui/button';
import { PulseDot } from '@/components/ui/pulse-dot';
import { FEATURE_FLAGS, useFeatureFlag } from '@/lib/feature-flags';
import { Route as AnnouncementsRoute } from '@/routes/announcements/index';

export function AnnouncementsButton() {
  const { t } = useTranslation(NAMESPACE);
  const enabled = useFeatureFlag(FEATURE_FLAGS.announcements);
  const unread = useHasUnreadAnnouncements();

  if (!enabled) return null;

  return (
    <Button
      asChild
      variant="secondary"
      size="icon"
      aria-label={unread ? t('openUnread') : t('open')}
      className="bg-card text-foreground hover:bg-card/80 pointer-events-auto relative size-11 rounded-lg shadow-[0_6px_16px_rgba(0,0,0,0.28)]"
    >
      <Link to={AnnouncementsRoute.to}>
        <Bell
          className={unread ? 'motion-safe:animate-bell-ring size-5' : 'size-5'}
          style={{ '--ring-cycle': `${ANNOUNCEMENT_PULSE_MS}ms` } as React.CSSProperties}
        />
        {unread && (
          <PulseDot cycleMs={ANNOUNCEMENT_PULSE_MS} className="absolute top-2 right-2 size-2.5" />
        )}
      </Link>
    </Button>
  );
}
