import { useEffect, useRef, useState } from 'react';

import { useStations } from '@/api/transit';
import { resolveReportLocation } from './report-location';
import { useSubmitReport } from '@/api/reports';
import { useGeolocation } from '@/contexts/Geolocation.context';
import { track } from '@/lib/analytics';
import { captureIssue } from '@/lib/error-monitoring';
import { FEATURE_FLAGS, getFeatureFlagVariant } from '@/lib/feature-flags';
import { notifySuccess } from '@/lib/haptics';

import { useReportVerification } from './useReportVerification';
import { failedCheck } from './report-verification';
import {
  runReportSubmission,
  showReportConfirmation,
  type DeviceOutcome,
  type LocationOutcome,
  type ReportSelection,
  type SubmissionPhase,
} from './report-submission-flow';
export type { ReportSelection } from './report-submission-flow';
import type { VerificationChecks } from './report-verification';
import { ReportTurnstileSession } from './report-turnstile-session';

// Cap on waiting for a first fix that was already in flight when the user pressed submit.
const LOCATION_WAIT_MS = 4_000;
const wait = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(resolve, ms, value));

type SubmissionAttempt = {
  selection: ReportSelection;
  attemptId: string;
  startedAt: number;
};

export function useReportSubmission() {
  const [phase, setPhase] = useState<SubmissionPhase>({ kind: 'form' });
  const [sessionGeneration, setSessionGeneration] = useState(0);
  const turnstileContainerRef = useRef<HTMLDivElement>(null);
  const turnstileSessionRef = useRef<ReportTurnstileSession | null>(null);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  useEffect(() => {
    const container = turnstileContainerRef.current;
    if (!container) return;
    const session = new ReportTurnstileSession({
      container,
      onStage: (event) => track('report_turnstile_stage', event),
    });
    turnstileSessionRef.current = session;
    session.prefetch();
    return () => {
      session.dispose();
      if (turnstileSessionRef.current === session) turnstileSessionRef.current = null;
    };
  }, [sessionGeneration]);
  const geolocation = useGeolocation();
  const submitReport = useSubmitReport();
  const { data: stations } = useStations();
  const { verify, recordSubmission } = useReportVerification();

  const resolveLocation = async (
    stationId: string,
    attemptId: string,
    signal: AbortSignal,
  ): Promise<LocationOutcome> => {
    const startedAt = Date.now();
    let { position, accuracy, timestamp } = geolocation;

    if (!position && geolocation.status === 'loading') {
      const fix = await Promise.race([
        geolocation.requestLocation('report'),
        wait(LOCATION_WAIT_MS, null),
      ]);
      if (fix) {
        position = { lat: fix.coords.latitude, lng: fix.coords.longitude };
        accuracy = fix.coords.accuracy;
        timestamp = fix.timestamp;
      }
    }

    const result = await resolveReportLocation(
      { position, accuracy, timestamp },
      stations?.[stationId]?.coordinates,
      () => geolocation.refineLocation(),
    );
    if (!signal.aborted) {
      track('report_location_completed', {
        attemptId,
        durationMs: Date.now() - startedAt,
        ...result.diagnostics,
      });
    }
    return result.location;
  };

  const start = async (signal: AbortSignal) => {
    const attempt = attemptRef.current;
    if (!attempt) return;
    const { selection, attemptId, startedAt } = attempt;
    const session = turnstileSessionRef.current;
    await runReportSubmission(selection, {
      signal,
      resolveLocation: () => resolveLocation(selection.stationId, attemptId, signal),
      mintToken: async () => {
        if (!session) return { outcome: 'unavailable', token: undefined } satisfies DeviceOutcome;
        const result = await session.getToken(attemptId, signal);
        track('report_turnstile_completed', result.diagnostics);
        if (result.device.outcome === 'failed' || result.device.outcome === 'unavailable') {
          captureIssue('Turnstile token could not be obtained', result.diagnostics, {
            attemptId,
            turnstileOutcome: result.device.outcome,
            turnstileReason: result.diagnostics.reason ?? 'unknown',
          });
        }
        return result.device;
      },
      verify: (location) =>
        verify(selection.stationId, {
          position: location.position,
          accuracy: location.accuracy,
          timestamp: location.timestamp,
        }),
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
        if (next.kind === 'form') attemptRef.current = null;
        if (next.kind === 'rejected') {
          track('report_rejected', {
            attemptId,
            durationMs: Date.now() - startedAt,
            reason: failedCheck(next.checks)?.reason ?? 'verification_failed',
            stationId: selection.stationId,
          });
        }
        if (next.kind === 'form') setSessionGeneration((generation) => generation + 1);
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

  const submit = (selection: ReportSelection) => {
    if (attemptRef.current) return;
    const attempt: SubmissionAttempt = {
      selection,
      attemptId: crypto.randomUUID(),
      startedAt: Date.now(),
    };
    attemptRef.current = attempt;
    track('report_started', {
      attemptId: attempt.attemptId,
      stationId: selection.stationId,
      checkId: turnstileSessionRef.current?.checkId,
    });
    const checks: VerificationChecks = {
      location: { status: 'running' },
      device: { status: 'running' },
      activity: { status: 'pending' },
    };
    setPhase({ kind: 'verifying', selection, checks });
  };

  const reset = () => {
    attemptRef.current = null;
    setPhase({ kind: 'form' });
    setSessionGeneration((generation) => generation + 1);
  };

  const showSuccess = () => setPhase(showReportConfirmation);

  return {
    phase,
    submit,
    start,
    reset,
    showSuccess,
    turnstileContainerRef,
  };
}
