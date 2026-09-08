import { useEffect } from 'react';

import { useRoute } from '@/api/route';
import { clearJourneyHighlight, setJourneyHighlight } from '@/lib/journey-highlight';

type RouteLayerProps = {
  fromId: string;
  toId: string;
};

/**
 * Publishes the journey's segment ids for the map to paint. Renders nothing itself:
 * the drawing happens inside the lazily-loaded map (see JourneyLayer).
 */
export function RouteLayer({ fromId, toId }: RouteLayerProps) {
  const { data: plan } = useRoute(fromId, toId);

  useEffect(() => {
    if (!plan) return;
    setJourneyHighlight(
      plan.legs.flatMap((leg) =>
        leg.segments.map((segment) => segment.segmentId).filter((id): id is number => id !== null),
      ),
    );
  }, [plan]);

  useEffect(() => clearJourneyHighlight, []);

  return null;
}
