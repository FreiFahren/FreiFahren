// Single seam for error reporting. With no queue/retry, a failed pipeline run drops the
// message — for now we only log to the live tail.
//
// TODO(#689): wire real error tracking + alerting on error rates.
// https://github.com/FreiFahren/FreiFahren/issues/689
export function reportError(message: string, err: unknown, extra?: Record<string, unknown>): void {
    console.error(message, {
        error: err instanceof Error ? (err.stack ?? err.message) : String(err),
        ...extra,
    })
}
