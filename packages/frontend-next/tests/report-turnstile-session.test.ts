import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { getTurnstileToken } = vi.hoisted(() => ({ getTurnstileToken: vi.fn() }));

vi.mock('../src/lib/turnstile', async (importOriginal) => {
  const original = await importOriginal<typeof import('../src/lib/turnstile')>();
  return {
    ...original,
    getTurnstileToken,
    isTurnstileConfigured: () => true,
  };
});

import { ReportTurnstileSession } from '../src/components/report/report-turnstile-session';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((complete) => {
    resolve = complete;
  });
  return { promise, resolve };
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe('ReportTurnstileSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-11-28T12:00:00Z'));
    getTurnstileToken.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('mints a fresh token when the prefetched token is older than four minutes', async () => {
    getTurnstileToken.mockResolvedValueOnce('early-token').mockResolvedValueOnce('fresh-token');
    const session = new ReportTurnstileSession({
      container: {} as HTMLElement,
      onStage: () => {},
    });

    session.prefetch();
    await flushMicrotasks();
    vi.setSystemTime(new Date('2026-11-28T12:04:01Z'));

    const result = await session.getToken('attempt-1', new AbortController().signal);

    expect(getTurnstileToken).toHaveBeenCalledTimes(2);
    expect(result.device).toEqual({ outcome: 'passed', token: 'fresh-token' });
    expect(result.diagnostics).toMatchObject({
      acquisition: 'retry',
      earlyTokenUsed: false,
      retryCount: 1,
    });
    session.dispose();
  });

  it('shares the same pending check across replayed submit consumers', async () => {
    const pendingToken = deferred<string>();
    getTurnstileToken.mockReturnValue(pendingToken.promise);
    const session = new ReportTurnstileSession({
      container: {} as HTMLElement,
      onStage: () => {},
    });
    session.prefetch();

    const firstController = new AbortController();
    const first = session.getToken('attempt-1', firstController.signal);
    const replay = session.getToken('attempt-1', new AbortController().signal);
    firstController.abort();
    pendingToken.resolve('shared-token');

    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    await expect(replay).resolves.toMatchObject({
      device: { outcome: 'passed', token: 'shared-token' },
      diagnostics: { acquisition: 'joined', earlyTokenUsed: false },
    });
    expect(getTurnstileToken).toHaveBeenCalledTimes(1);
    session.dispose();
  });

  it('cannot share a token across report IDs or revive a disposed session', async () => {
    const provider = deferred<string>();
    getTurnstileToken.mockReturnValue(provider.promise);
    const session = new ReportTurnstileSession({ container: {} as HTMLElement, onStage: vi.fn() });
    const { signal } = new AbortController();
    session.prefetch();
    await Promise.resolve();
    const first = session.getToken('first', signal);
    await expect(session.getToken('other', signal)).rejects.toThrow();
    session.dispose();
    provider.resolve('late-token');
    await expect(first).rejects.toMatchObject({ name: 'AbortError' });
    session.prefetch();
    await expect(session.getToken('first', signal)).rejects.toMatchObject({ name: 'AbortError' });
    expect(getTurnstileToken).toHaveBeenCalledTimes(1);
  });

  it('ignores a token from the discarded early widget after it requested interaction', async () => {
    const early = deferred<string>();
    const visible = deferred<string>();
    getTurnstileToken
      .mockImplementationOnce((_action, { onStage }) => {
        onStage('interaction_required');
        return early.promise;
      })
      .mockReturnValueOnce(visible.promise);
    const session = new ReportTurnstileSession({ container: {} as HTMLElement, onStage: vi.fn() });
    session.prefetch();
    await Promise.resolve();
    early.resolve('discarded-token');
    await flushMicrotasks();
    const submitted = session.getToken('report', new AbortController().signal);
    visible.resolve('visible-token');
    await expect(submitted).resolves.toMatchObject({
      device: { outcome: 'passed', token: 'visible-token' },
      diagnostics: { acquisition: 'deferred', earlyTokenUsed: false },
    });
    expect(getTurnstileToken).toHaveBeenCalledTimes(2);
  });

  it('reuses a cached acquisition result when the submit effect replays', async () => {
    getTurnstileToken.mockResolvedValueOnce('cached-token');
    const session = new ReportTurnstileSession({
      container: {} as HTMLElement,
      onStage: () => {},
    });
    session.prefetch();
    await flushMicrotasks();

    const first = await session.getToken('attempt-1', new AbortController().signal);
    const replay = await session.getToken('attempt-1', new AbortController().signal);

    expect(getTurnstileToken).toHaveBeenCalledTimes(1);
    expect(first.device).toEqual({ outcome: 'passed', token: 'cached-token' });
    expect(replay).toEqual(first);
    session.dispose();
  });
});
