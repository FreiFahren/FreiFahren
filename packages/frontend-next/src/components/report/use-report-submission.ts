import { useEffect, useRef, useState } from 'react';

import { useStations } from '@/api/transit';
import { resolveReportLocation } from './report-location';
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

// Cap on waiting for a first fix that was already in flight when the user pressed submit.
const LOCATION_WAIT_MS = 4_000;
const wait = <T>(ms: number, value: T) =>
  new Promise<T>((resolve) => setTimeout(resolve, ms, value));

type EarlyToken = { token: string; createdAt: number };
type SubmissionAttempt = {
  selection: ReportSelection;
  attemptId: string;
  startedAt: number;
  earlyToken?: EarlyToken;
  interactionRequired: boolean;
};

// Turnstile tokens expire after five minutes; reserve one minute for delivery and validation.
const TOKEN_MAX_AGE_MS = 240_000;

export function useReportSubmission() {
  const [phase, setPhase] = useState<SubmissionPhase>({ kind: 'form' });
  const earlyTurnstileContainerRef = useRef<HTMLDivElement>(null);
  const earlyTokenRef = useRef<EarlyToken | null>(null);
  const earlyControllerRef = useRef<AbortController | null>(null);
  const interactionRequiredRef = useRef(false);
  const attemptRef = useRef<SubmissionAttempt | null>(null);
  const isForm = phase.kind === 'form';
  useEffect(() => {
    if (!isForm) return;
    const container = earlyTurnstileContainerRef.current;
    if (!container) return;
    const controller = new AbortController();
    earlyControllerRef.current = controller;
    earlyTokenRef.current = null;
    interactionRequiredRef.current = false;
    void getTurnstileToken('submit-report', {
      container,
      signal: controller.signal,
      onInteractionRequired: () => {
        interactionRequiredRef.current = true;
        controller.abort();
      },
    })
      .then((token) => {
        if (token && !controller.signal.aborted) {
          earlyTokenRef.current = { token, createdAt: Date.now() };
        }
      })
      .catch(() => {});
    return () => {
      controller.abort();
      if (earlyControllerRef.current === controller) earlyControllerRef.current = null;
    };
  }, [isForm]);
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

  const mintToken = async (
    attempt: SubmissionAttempt,
    container: HTMLDivElement,
    signal: AbortSignal,
  ): Promise<DeviceOutcome> => {
    const startedAt = Date.now();
    const tokenAgeMs = attempt.earlyToken ? Date.now() - attempt.earlyToken.createdAt : undefined;
    const reusableToken =
      attempt.earlyToken &&
      tokenAgeMs !== undefined &&
      tokenAgeMs >= 0 &&
      tokenAgeMs < TOKEN_MAX_AGE_MS
        ? attempt.earlyToken
        : undefined;
    const earlyTokenUsed = reusableToken !== undefined;
    let interactionRequired = attempt.interactionRequired;
    const timing = () => ({
      attemptId: attempt.attemptId,
      durationMs: Date.now() - startedAt,
      timeoutMs: TOKEN_TIMEOUT_MS,
      earlyTokenUsed,
      tokenAgeMs,
      interactionRequired,
    });
    const configured = isTurnstileConfigured();
    try {
      const token = await (reusableToken?.token ??
        getTurnstileToken('submit-report', {
          container,
          signal,
          onInteractionRequired: () => {
            interactionRequired = true;
          },
        }));
      if (signal.aborted) throw new DOMException('Cancelled', 'AbortError');
      if (configured && !token) {
        throw new TurnstileError('Turnstile returned no token', 'unknown');
      }
      track('report_turnstile_completed', {
        ...timing(),
        outcome: configured ? 'passed' : 'disabled',
      });
      return { token, outcome: configured ? 'passed' : 'disabled' };
    } catch (error) {
      if (signal.aborted) throw error;
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

  const start = async (container: HTMLDivElement, signal: AbortSignal) => {
    const attempt = attemptRef.current;
    if (!attempt) return;
    const { selection, attemptId, startedAt } = attempt;
    await runReportSubmission(selection, {
      signal,
      resolveLocation: () => resolveLocation(selection.stationId, attemptId, signal),
      mintToken: () => mintToken(attempt, container, signal),
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
    const cached = earlyTokenRef.current;
    const attempt: SubmissionAttempt = {
      selection,
      attemptId: crypto.randomUUID(),
      startedAt: Date.now(),
      earlyToken: cached ?? undefined,
      interactionRequired: interactionRequiredRef.current,
    };
    earlyTokenRef.current = null;
    earlyControllerRef.current?.abort();
    attemptRef.current = attempt;
    track('report_started', { attemptId: attempt.attemptId, stationId: selection.stationId });
    const checks: VerificationChecks = {
      location: { status: 'running' },
      device: { status: 'running' },
      activity: { status: 'pending' },
    };
    setPhase({ kind: 'verifying', selection, checks });
  };

  const reset = () => {
    attemptRef.current = null;
    earlyTokenRef.current = null;
    interactionRequiredRef.current = false;
    setPhase({ kind: 'form' });
  };

  const showSuccess = () => setPhase(showReportConfirmation);

  return { phase, submit, start, reset, showSuccess, earlyTurnstileContainerRef };
}
