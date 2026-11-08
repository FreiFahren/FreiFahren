# @freifahren/contracts

What crosses a boundary between two FreiFahren Workers, or between a Worker and the app, written once and imported by both sides. Each module covers one boundary:

| Module                 | Provider                                                                       | Callers         |
| ---------------------- | ------------------------------------------------------------------------------ | --------------- |
| `auth`                 | auth-worker's `SessionsEntrypoint`                                             | API, Fund       |
| `report-gate`          | report-gate's `PublicReportsEntrypoint` and `TrustedTelegramReportsEntrypoint` | API             |
| `report-notifications` | telegram-worker's `TelegramNotificationsEntrypoint`                            | report-gate     |
| `telegram-reports`     | API's `TelegramReportsEntrypoint`                                              | telegram-worker |
| `admin`                | API's admin routes                                                             | report-admin    |
| `fund`                 | Fund Worker's HTTP API                                                         | app             |

A provider `implements` its contract, so changing one side without the other fails typecheck instead of failing at runtime. Where a module has zod schemas, the provider parses its input with them and a caller parses the response, since the two deploy separately.
