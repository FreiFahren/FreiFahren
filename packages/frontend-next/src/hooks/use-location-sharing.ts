import { useEffect, useRef, useState } from 'react';

import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import {
  closeLocationPrompt,
  dismissMapLocationPrompt,
  isMapLocationPromptDismissed,
  LOCATION_PROMPT_DELAY_MS,
  openLocationPrompt,
  queryGeolocationPermission,
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
  const { notifyError, requestLocation } = useGeolocation();
  const [showPrompt, setShowPrompt] = useState(false);
  const evaluatedRef = useRef(false);
  const promptTrackedRef = useRef(false);
  const requestLocationRef = useRef(requestLocation);
  const notifyErrorRef = useRef(notifyError);

  useEffect(() => {
    requestLocationRef.current = requestLocation;
    notifyErrorRef.current = notifyError;
  }, [requestLocation, notifyError]);

  useEffect(() => {
    if (!enabled || evaluatedRef.current) return;

    let cancelled = false;
    let timer = 0;

    void queryGeolocationPermission().then((permission) => {
      if (cancelled || evaluatedRef.current) return;
      evaluatedRef.current = true;
      track('location_permission_evaluated', { state: permission });

      if (permission === 'granted') {
        void requestLocationRef.current('auto');
      } else if (permission === 'denied') {
        notifyErrorRef.current(1);
      } else {
        timer = window.setTimeout(() => {
          if (!cancelled && !isMapLocationPromptDismissed()) setShowPrompt(true);
        }, LOCATION_PROMPT_DELAY_MS);
      }
    });

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [enabled]);

  const visible = showPrompt && canDisplay;
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
  const [phase, setPhase] = useState<'checking' | 'prompt' | 'complete'>(
    position || status === 'denied' ? 'complete' : 'checking',
  );
  const mountedRef = useMountedRef();
  const promptTrackedRef = useRef(false);
  const initialPositionRef = useRef(position);
  const initialStatusRef = useRef(status);
  const requestLocationRef = useRef(requestLocation);

  useEffect(() => {
    let cancelled = false;

    const prepare = async () => {
      if (initialPositionRef.current || initialStatusRef.current === 'denied') {
        setPhase('complete');
        return;
      }

      const permission = await queryGeolocationPermission();
      if (cancelled) return;
      if (permission === 'granted') {
        await requestLocationRef.current('report');
        if (!cancelled) setPhase('complete');
        return;
      }
      if (permission === 'denied') {
        setPhase('complete');
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
