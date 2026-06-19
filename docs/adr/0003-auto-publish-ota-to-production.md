# Auto-publish OTA bundles to production on every main commit

## Status

accepted

## Context

OTA bundles bypass App Store review, so a published bundle reaches all users on their next launch
within minutes. We had to decide whether to gate production releases behind a manual step or a beta
channel, or to publish automatically.

## Decision

Every push to `main` that touches `packages/frontend-next` **auto-publishes** an OTA bundle straight
to the `production` channel (the `publish-ota` job in `frontend-next-deploy.yml`, gated on the same
lint/format/build checks as the web deploy). There is no manual gate and no beta channel for now —
we optimise for fast iteration.

## Considered alternatives

- **Beta channel + manual promote:** real on-device review before going wide, but requires standing
  up a second channel and a promotion step. Deferred — the manifest is already channel-ready, so we
  can add it later without rework.
- **Manual dispatch to production:** controls *when*, not *what* — still no preview, just more
  friction. Rejected as the worst of both.

## Consequences

- A bad bundle reaches all users quickly. Two safety nets cover this: the plugin auto-rolls-back a
  bundle that fails to call `notifyAppReady()` on boot, and a bad-but-booting bundle is undone by
  repointing `channels/production.json` at the previous bundle (one CI action / R2 write).
- This is a deliberate trade-off favouring speed over a review gate; revisit by enabling the deferred
  beta channel if instability shows up.
