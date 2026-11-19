import { useRef, useState } from 'react';

import { useSubmitReport } from '@/api/reports';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { captureIssue } from '@/lib/error-monitoring';
import { FEATURE_FLAGS, getFeatureFlagVariant } from '@/lib/feature-flags';
import { notifySuccess } from '@/lib/haptics';
import {
  getTurnstileToken,
  isTurnstileConfigured,
  TOKEN_TIMEOUT_MS,
  TurnstileError,
} from '@/lib/turnstile';

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

  const mintToken = async (attemptId: string): Promise<DeviceOutcome> => {
    const startedAt = Date.now();
    const timing = () => ({
      attemptId,
      durationMs: Date.now() - startedAt,
      timeoutMs: TOKEN_TIMEOUT_MS,
    });
    if (!isTurnstileConfigured()) {
      track('report_turnstile_completed', { ...timing(), outcome: 'disabled' });
      return { token: undefined, outcome: 'disabled' };
    }
    try {
      const token = await getTurnstileToken('submit-report');
      track('report_turnstile_completed', { ...timing(), outcome: 'passed' });
      return { token, outcome: 'passed' };
    } catch (error) {
      const failure = {
        ...timing(),
        reason: error instanceof TurnstileError ? error.reason : ('unknown' as const),
        errorCode: error instanceof TurnstileError ? error.code : undefined,
      };
      captureIssue('Turnstile token could not be obtained', {
        ...failure,
        message: error instanceof Error ? error.message : String(error),
      });
      track('report_turnstile_completed', { ...failure, outcome: 'failed' });
      return { token: undefined, outcome: 'failed' };
    }
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
    const attemptId = crypto.randomUUID();
    track('report_started', { attemptId, stationId: selection.stationId });
    await runReportSubmission(selection, {
      resolveLocation,
      mintToken: () => mintToken(attemptId),
      verify: (location) =>
        verify(selection.stationId, { position: location.position, accuracy: location.accuracy }),
      send: (turnstileToken) =>
        submitReport
          .mutateAsync({ ...selection, turnstileToken, attemptId })
          .catch((error: unknown) => {
            captureIssue('Report submission flow failed', {
              attemptId,
              reason: error instanceof Error ? error.message : String(error),
            });
            throw error;
          }),
      onVerified: (location, device) => {
        recordSubmission(selection.stationId);
        track('report_verified', {
          attemptId,
          location: location.outcome,
          turnstile: device.outcome,
          durationMs: Date.now() - startedAt,
        });
      },
      onPhase: (next) => {
        setPhase(next);
        if (next.kind === 'rejected') {
          track('report_rejected', {
            attemptId,
            durationMs: Date.now() - startedAt,
            reason: failedCheck(next.checks)?.reason ?? 'verification_failed',
            stationId: selection.stationId,
          });
        }
        if (next.kind === 'delivered') {
          notifySuccess();
          getFeatureFlagVariant(FEATURE_FLAGS.contributeModalTiming);
          track('report_submitted', {
            attemptId,
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
