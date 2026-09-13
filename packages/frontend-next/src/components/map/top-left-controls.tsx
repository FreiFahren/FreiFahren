import { AnnouncementsButton } from './announcements-button';
import { SettingsButton } from './SettingsButton';

// One wrapper positions the stack, so adding a button doesn't mean recomputing `top-safe-*` by
// hand. Breakpoint is shared with LayerToggleButton.
export function TopLeftControls() {
  return (
    <div className="top-safe-14 pointer-events-none fixed left-0 z-20 flex flex-col items-start gap-1.5 p-3 md:top-0">
      <SettingsButton />
      <AnnouncementsButton />
    </div>
  );
}
