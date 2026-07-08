// The @sentry/cloudflare HTTP instrumentation names transactions from the raw URL pathname.
// Each station therefore turns GET /v0/reports/<stationId> into its own transaction (…/BAHU,
// …/BOSB, …). Collapse that single trailing segment into the route pattern so Sentry tracks the
// Per-station reads as one transaction, while leaving the list endpoint (GET /v0/reports) untouched.
export const normalizeTransactionName = (name: string): string =>
    name.replace(/^(\w+ \/v\d+\/reports)\/[^/]+$/, '$1/:stationId')
