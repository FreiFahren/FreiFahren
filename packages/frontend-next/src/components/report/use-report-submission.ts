import { useRef, useState } from 'react';

import { useSubmitReport } from '@/api/reports';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { captureIssue } from '@/lib/error-monitoring';
import { FEATURE_FLAGS, getFeatureFlagVariant } from '@/lib/feature-flags';
import { notifySuccess } from '@/lib/haptics';
import { getTurnstileToken, isTurnstileConfigured } from '@/lib/turnstile';

import { useReportVerification } from './useReportVerification';
import { failedCheck, isUsableFix } from './report-verification';
import {
  runReportSubmission,
  showReportConfirmation,
  type DeviceOutcome,
  type LocationOutcome,
  type ReportSelection,
  type SubmissionPhase,
} from './report-submission-flow';
export type { ReportSelection } from './report-submission-flow';

// Cap on waiting for a first fix that was already in flight when the user pressed submit.
const LOCATION_WAIT_MS = 4_000;
// Per attempt. Two attempts fit inside the time a single 20s default would have taken.
const TURNSTILE_ATTEMPT_MS = 8_000;
const wait = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(resolve, ms, value));

export function useReportSubmission() {
  const [phase, setPhase] = useState<SubmissionPhase>({ kind: 'form' });
  // Two taps in the same frame both see the stale `form` phase; the ref is what stops the second.
  const inFlightRef = useRef(false);
  const geolocation = useGeolocation();
  const submitReport = useSubmitReport();
  const { verify, recordSubmission } = useReportVerification();

  const resolveLocation = async (): Promise<LocationOutcome> => {
    let { position, accuracy } = geolocation;

    if (!position && geolocation.status === 'loading') {
      const coords = await Promise.race([
        geolocation.requestLocation('report'),
        wait(LOCATION_WAIT_MS, null),
      ]);
      if (coords) {
        position = { lat: coords.latitude, lng: coords.longitude };
        accuracy = coords.accuracy;
      }
    }

    if (!position) return { position: null, accuracy: null, outcome: 'none' };
    if (isUsableFix(accuracy)) return { position, accuracy, outcome: 'accurate' };

    const refined = await geolocation.refineLocation();
    if (refined && isUsableFix(refined.accuracy)) {
      return {
        position: { lat: refined.latitude, lng: refined.longitude },
        accuracy: refined.accuracy,
        outcome: 'refined',
      };
    }
    // Still too coarse to place the user: the distance rule sits out rather than guessing.
    return { position: null, accuracy: null, outcome: 'coarse' };
  };

  const mintToken = async (): Promise<DeviceOutcome> => {
    if (!isTurnstileConfigured()) return { token: undefined, outcome: 'disabled' };

    for (const attempt of [1, 2] as const) {
      try {
        const token = await getTurnstileToken('submit-report', { timeoutMs: TURNSTILE_ATTEMPT_MS });
        return { token, outcome: attempt === 1 ? 'passed' : 'retried' };
      } catch (error) {
        captureIssue('Turnstile token could not be obtained', {
          reason: error instanceof Error ? error.message : String(error),
          attempt,
        });
      }
    }
    // Keep the report unsent when the configured check could not complete; the user can retry.
    return { token: undefined, outcome: 'failed' };
  };

  const submit = async (selection: ReportSelection) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    try {
      await run(selection);
    } finally {
      inFlightRef.current = false;
    }
  };

  const run = async (selection: ReportSelection) => {
    const startedAt = Date.now();
    await runReportSubmission(selection, {
      resolveLocation,
      mintToken,
      verify: (location) =>
        verify(selection.stationId, { position: location.position, accuracy: location.accuracy }),
      send: (turnstileToken) =>
        submitReport.mutateAsync({ ...selection, turnstileToken }).catch((error: unknown) => {
          captureIssue('Report submission flow failed', {
            reason: error instanceof Error ? error.message : String(error),
          });
          throw error;
        }),
      onVerified: (location, device) => {
        recordSubmission(selection.stationId);
        track('report_verified', {
          location: location.outcome,
          turnstile: device.outcome,
          durationMs: Date.now() - startedAt,
        });
      },
      onPhase: (next) => {
        setPhase(next);
        if (next.kind === 'rejected') {
          track('report_rejected', {
            reason: failedCheck(next.checks)?.reason ?? 'verification_failed',
            stationId: selection.stationId,
          });
        }
        if (next.kind === 'delivered') {
          notifySuccess();
          getFeatureFlagVariant(FEATURE_FLAGS.contributeModalTiming);
          track('report_submitted', {
            stationId: next.result.stationId,
            lineId: next.result.lineId,
            directionId: next.result.directionId,
          });
        }
      },
    });
  };

  const reset = () => setPhase({ kind: 'form' });

  const showSuccess = () => setPhase(showReportConfirmation);

  return { phase, submit, reset, showSuccess };
}
