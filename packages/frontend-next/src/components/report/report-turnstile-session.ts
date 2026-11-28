import {
  getTurnstileToken,
  isTurnstileChallengeFailure,
  isTurnstileConfigured,
  TurnstileError,
  type TurnstileFailureReason,
  type TurnstileStage,
} from '@/lib/turnstile';
import type { DeviceOutcome } from './report-submission-flow';

export const REPORT_TURNSTILE_FLOW_VERSION = 'early-check-v2';
const TOKEN_MAX_AGE_MS = 240_000;

type CheckContext = {
  checkId: string;
  flowVersion: typeof REPORT_TURNSTILE_FLOW_VERSION;
  attemptNumber: number;
};
export type ReportTurnstileStageEvent = CheckContext & {
  attemptId?: string;
  flow: 'prefetch' | 'submit';
  stage: TurnstileStage | 'interaction_deferred';
  elapsedMs: number;
  reason?: TurnstileFailureReason;
  errorCode?: string;
};
type CheckDetails = {
  reason?: TurnstileFailureReason;
  errorCode?: string;
  scriptDurationMs?: number;
  widgetDurationMs?: number;
  hiddenMs: number;
  scriptRetries: number;
  interactionRequired: boolean;
};
export type ReportTurnstileCompletedEvent = CheckContext &
  CheckDetails & {
    attemptId: string;
    flow: 'submit';
    outcome: DeviceOutcome['outcome'];
    durationMs: number;
    acquisition: 'cached' | 'joined' | 'fresh' | 'retry' | 'deferred';
    retryCount: number;
    earlyTokenUsed: boolean;
    tokenAgeMs?: number;
  };

type CheckResult = { device: DeviceOutcome; details: CheckDetails; finishedAt: number };
type BeforeSubmit =
  | { kind: 'idle' }
  | { kind: 'prechecking'; pending: Promise<CheckResult>; controller: AbortController }
  | { kind: 'precheckFinished'; result: CheckResult }
  | { kind: 'awaitingSubmit' };
type SessionState =
  | BeforeSubmit
  | {
      kind: 'submitted';
      id: string;
      pending: Promise<SubmissionResult>;
      controller: AbortController;
    }
  | { kind: 'disposed' };
type SubmissionResult = { device: DeviceOutcome; diagnostics: ReportTurnstileCompletedEvent };
type SessionOptions = {
  container: HTMLElement;
  onStage: (event: ReportTurnstileStageEvent) => void;
};

const elapsed = (start: number, end = performance.now()) => Math.round(Math.max(0, end - start));
const cancelled = () => new DOMException('Turnstile cancelled', 'AbortError');

/** One form owns one widget at a time and one submission, even when a React effect replays. */
export class ReportTurnstileSession {
  readonly checkId = crypto.randomUUID();
  private state: SessionState = { kind: 'idle' };
  private attemptNumber = 0;
  private readonly options: SessionOptions;

  constructor(options: SessionOptions) {
    this.options = options;
  }

  prefetch() {
    if (this.state.kind !== 'idle' || !isTurnstileConfigured()) return;
    const controller = new AbortController();
    const pending = this.startCheck(controller);
    const precheck = { kind: 'prechecking', pending, controller } as const;
    this.state = precheck;
    void pending.then((result) => {
      if (this.state === precheck) this.state = { kind: 'precheckFinished', result };
    });
  }

  private deferInteraction(controller: AbortController): boolean {
    if (this.state.kind !== 'prechecking' || this.state.controller !== controller) return false;
    this.state = { kind: 'awaitingSubmit' };
    controller.abort();
    return true;
  }

  dispose() {
    const previous = this.state;
    this.state = { kind: 'disposed' };
    if (previous.kind === 'prechecking' || previous.kind === 'submitted')
      previous.controller.abort();
  }

  async getToken(attemptId: string, signal: AbortSignal): Promise<SubmissionResult> {
    const previous = this.state;
    if (signal.aborted || previous.kind === 'disposed') throw cancelled();
    let submission: Extract<SessionState, { kind: 'submitted' }>;
    if (previous.kind === 'submitted') {
      if (previous.id !== attemptId) throw new Error('Turnstile session already submitted');
      submission = previous;
    } else {
      const controller =
        previous.kind === 'prechecking' ? previous.controller : new AbortController();
      const pending = this.acquire(previous, attemptId, controller);
      submission = { kind: 'submitted', id: attemptId, pending, controller };
      this.state = submission;
    }
    const result = await submission.pending;
    if (signal.aborted || submission.controller.signal.aborted) throw cancelled();
    return result;
  }

  private async acquire(
    previous: BeforeSubmit,
    attemptId: string,
    controller: AbortController,
  ): Promise<SubmissionResult> {
    const start = performance.now();
    let acquisition: ReportTurnstileCompletedEvent['acquisition'];
    let age: number | undefined;
    let result: CheckResult;
    switch (previous.kind) {
      case 'idle':
        acquisition = 'fresh';
        result = await this.startCheck(controller, attemptId);
        break;
      case 'prechecking':
        acquisition = 'joined';
        result = await previous.pending;
        break;
      case 'awaitingSubmit':
        acquisition = 'deferred';
        result = await this.startCheck(controller, attemptId);
        break;
      case 'precheckFinished':
        result = previous.result;
        age = result.device.outcome === 'passed' ? Date.now() - result.finishedAt : undefined;
        if (
          result.device.outcome === 'failed' ||
          (age !== undefined && age >= 0 && age < TOKEN_MAX_AGE_MS)
        ) {
          acquisition = 'cached';
        } else {
          acquisition = 'retry';
          result = await this.startCheck(controller, attemptId);
        }
        break;
    }
    const earlyTokenUsed = acquisition === 'cached' && result.device.outcome === 'passed';
    return {
      device: result.device,
      diagnostics: {
        ...result.details,
        checkId: this.checkId,
        flowVersion: REPORT_TURNSTILE_FLOW_VERSION,
        attemptNumber: this.attemptNumber,
        attemptId,
        flow: 'submit',
        outcome: result.device.outcome,
        acquisition,
        durationMs: elapsed(start),
        earlyTokenUsed,
        tokenAgeMs: earlyTokenUsed ? age : undefined,
        retryCount: acquisition === 'retry' ? 1 : 0,
      },
    };
  }

  private async startCheck(controller: AbortController, attemptId?: string): Promise<CheckResult> {
    const details: CheckDetails = { hiddenMs: 0, scriptRetries: 0, interactionRequired: false };
    if (!isTurnstileConfigured()) {
      return { device: { outcome: 'disabled', token: undefined }, details, finishedAt: Date.now() };
    }
    const context = {
      checkId: this.checkId,
      attemptId,
      attemptNumber: ++this.attemptNumber,
      flowVersion: REPORT_TURNSTILE_FLOW_VERSION,
      flow: attemptId ? 'submit' : 'prefetch',
    } as const;
    const start = performance.now();
    let ready: number | undefined;
    let renderStarted: number | undefined;
    let hiddenSince: number | undefined;
    const stage = (name: ReportTurnstileStageEvent['stage']) => {
      const now = performance.now();
      if (name === 'script_retry') details.scriptRetries++;
      if (name === 'script_ready') ready = now;
      if (name === 'widget_render_started') renderStarted = now;
      if (name === 'interaction_required') details.interactionRequired = true;
      if (name === 'hidden') hiddenSince ??= now;
      if (name === 'visible' && hiddenSince !== undefined) {
        details.hiddenMs += elapsed(hiddenSince, now);
        hiddenSince = undefined;
      }
      try {
        this.options.onStage({
          ...context,
          stage: name,
          elapsedMs: elapsed(start, now),
          reason: details.reason,
          errorCode: details.errorCode,
        });
      } catch {
        // A telemetry outage cannot change the result of verification.
      }
    };

    let device: DeviceOutcome;
    try {
      // Install the owning state before a provider callback can synchronously cancel the check.
      await Promise.resolve();
      if (controller.signal.aborted) throw cancelled();
      const token = await getTurnstileToken('submit-report', {
        container: this.options.container,
        signal: controller.signal,
        onStage: (name) => {
          if (name === 'interaction_required' && this.deferInteraction(controller)) {
            stage('interaction_deferred');
          } else if (!controller.signal.aborted && name !== 'error' && name !== 'cancelled')
            stage(name);
        },
      });
      if (controller.signal.aborted) throw cancelled();
      if (!token) throw new TurnstileError('Turnstile returned no token', 'unknown');
      device = { outcome: 'passed', token };
    } catch (error) {
      const aborted = controller.signal.aborted;
      if (!aborted) {
        details.reason = error instanceof TurnstileError ? error.reason : 'unknown';
        details.errorCode = error instanceof TurnstileError ? error.code : undefined;
      }
      stage(aborted ? 'cancelled' : 'error');
      device = {
        outcome: isTurnstileChallengeFailure(error) ? 'failed' : 'unavailable',
        token: undefined,
      };
    }
    const end = performance.now();
    details.scriptDurationMs = elapsed(start, ready ?? end);
    if (renderStarted !== undefined) details.widgetDurationMs = elapsed(renderStarted, end);
    if (hiddenSince !== undefined) details.hiddenMs += elapsed(hiddenSince, end);
    return { device, details, finishedAt: Date.now() };
  }
}
