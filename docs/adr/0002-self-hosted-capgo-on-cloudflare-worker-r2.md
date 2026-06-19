# Self-host Capgo OTA on a Cloudflare Worker + R2

## Status

accepted

## Context

The Capacitor app (`packages/frontend-next`) needs over-the-air web-asset updates so web-only fixes
ship without an App Store round-trip. Capgo's `@capgo/capacitor-updater` plugin supports either
Capgo's hosted cloud or a self-hosted update server.

## Decision

Self-host the update server as a small **Cloudflare Worker** (`packages/capgo-worker`,
`updates.freifahren.org`) backed by an **R2 bucket** (`freifahren-ota`). The Worker implements the
plugin's self-hosted contract — a `POST /updates` version check returning `{version, url, checksum}`
and `GET /bundles/<version>.zip` streaming from R2 — and is **read-only**: CI writes bundles and the
channel manifest straight to R2.

## Considered alternatives

- **Capgo cloud (SaaS):** dashboard, channels, analytics, encryption for free, but a paid recurring
  dependency and our update traffic/keys live on a third party. Rejected — we already run
  on Cloudflare and the self-hosted contract is tiny.

## Consequences

- We own the protocol: no dashboard, channel UI, analytics, or bundle encryption unless we build
  them. The manifest is channel-addressed (`channels/<channel>.json`) so a `beta` channel is a config
  change, not a rewrite.
- Single-vendor on Cloudflare; reuses the existing account, custom-domain DNS, and CI credentials.
- Provisioning currently lives in the Cloudflare API/MCP, not Terraform; import into the `infra` repo
  when it lands.
