import { useEffect, useRef, useState } from 'react';

import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import {
  closeLocationPrompt,
  dismissMapLocationPrompt,
  isMapLocationPromptDismissed,
  LOCATION_PROMPT_DELAY_MS,
  openLocationPrompt,
  getLocationSharingAction,
} from '@/lib/location-prompt';

function useMountedRef() {
  const mountedRef = useRef(false);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  return mountedRef;
}

export function useMapLocationSharing({
  enabled,
  canDisplay,
}: {
  enabled: boolean;
  canDisplay: boolean;
}) {
  const { position, requestLocation, status } = useGeolocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const [action, setAction] = useState<Awaited<ReturnType<typeof getLocationSharingAction>> | null>(
    null,
  );
  const promptTrackedRef = useRef(false);
  const requestLocationRef = useRef(requestLocation);
  const hasLocation = position !== null || status === 'tracking';

  useEffect(() => {
    requestLocationRef.current = requestLocation;
  }, [requestLocation]);

  useEffect(() => {
    if (hasLocation) {
      closeLocationPrompt('map');
    }
  }, [hasLocation]);

  useEffect(() => {
    if (!enabled || hasLocation || action !== null) return;

    let cancelled = false;
    void getLocationSharingAction().then((result) => {
      if (cancelled) return;
      setAction(result);
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, hasLocation, action]);

  useEffect(() => {
    if (!enabled || hasLocation || action === null) return;

    if (action === 'request') {
      void requestLocationRef.current('auto');
      return;
    }

    if (action === 'denied') return;

    const timer = window.setTimeout(() => {
      if (!isMapLocationPromptDismissed()) setShowPrompt(true);
    }, LOCATION_PROMPT_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [enabled, hasLocation, action]);

  const visible = showPrompt && canDisplay && !hasLocation;
  useEffect(() => {
    if (!visible) {
      closeLocationPrompt('map');
      return;
    }

    openLocationPrompt('map');
    if (!promptTrackedRef.current) {
      promptTrackedRef.current = true;
      track('location_prompt_shown', { source: 'map' });
    }
    return () => closeLocationPrompt('map');
  }, [visible]);

  const allow = () => {
    track('location_prompt_allowed', { source: 'map' });
    setShowPrompt(false);
    closeLocationPrompt('map');
    void requestLocation('soft_prompt');
  };

  const dismiss = () => {
    track('location_prompt_dismissed', { source: 'map' });
    dismissMapLocationPrompt();
    setShowPrompt(false);
    closeLocationPrompt('map');
  };

  return { visible, allow, dismiss };
}

export function useReportLocationSharing() {
  const { position, requestLocation, status } = useGeolocation();
  const [phase, setPhase] = useState<'checking' | 'prompt' | 'denied' | 'complete'>(
    position ? 'complete' : 'checking',
  );
  const mountedRef = useMountedRef();
  const promptTrackedRef = useRef(false);
  const initialPositionRef = useRef(position);
  const requestLocationRef = useRef(requestLocation);

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (initialPositionRef.current) return;

      const action = await getLocationSharingAction();
      if (cancelled) return;
      if (action === 'request') {
        await requestLocationRef.current('report');
        if (cancelled) return;
        setPhase('complete');
        return;
      }

      if (action === 'denied') {
        setPhase('denied');
        openLocationPrompt('report');
        track('location_permission_blocked_shown', { source: 'report' });
        return;
      }

      setPhase('prompt');
      openLocationPrompt('report');
      if (!promptTrackedRef.current) {
        promptTrackedRef.current = true;
        track('location_prompt_shown', { source: 'report' });
      }
    };

    void prepare();
    return () => {
      cancelled = true;
      closeLocationPrompt('report');
    };
  }, []);

  const finish = () => {
    closeLocationPrompt('report');
    setPhase('complete');
  };

  const allow = async () => {
    track('location_prompt_allowed', { source: 'report' });
    await requestLocation('report');
    if (mountedRef.current) finish();
  };

  const dismiss = () => {
    track('location_prompt_dismissed', { source: 'report' });
    finish();
  };

  return { phase, loading: status === 'loading', allow, dismiss };
}
