# @freifahren/worker-kit

Plumbing the FreiFahren Workers share, public and private alike.

- `logger`: the structured logger. `createLogger(level)` writes to the console and, once the Worker's entry point has called `setSentryLogSink` with Sentry's logger, to Sentry Logs. A Worker that needs a logger outside request handling, like a CLI or a module-level one, builds it from `createLogger` itself.
