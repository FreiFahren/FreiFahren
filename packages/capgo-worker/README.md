# capgo-worker

Self-hosted [Capgo](https://capgo.app) over-the-air update server for the FreiFahren Capacitor app,
running on Cloudflare Workers + R2. Serves `updates.freifahren.org`.

## How it works

```
Capacitor app (@capgo/capacitor-updater, autoUpdate)
  └─ POST /updates  ── version check, each launch
                       ↳ reads channels/production.json from R2
                       ↳ returns { version, url, checksum } or {} if current
  └─ GET  /bundles/<version>.zip  ── streams the bundle from R2
```

Bundles and the channel manifest are written to the R2 bucket **by CI** (see
`.github/workflows/frontend-next-deploy.yml`), not by this Worker — it is read-only.

- **Versioning:** bundle version is `1.0.<github-run-number>` (monotonic semver).
- **Rollback:** repoint `channels/production.json` at an older bundle; the app picks it up next launch.
  A bundle that fails to boot (no `notifyAppReady()`) auto-rolls-back client-side.

## Resources

- R2 bucket `freifahren-ota` (binding `BUNDLES`)
- Custom domain `updates.freifahren.org`

These were provisioned via the Cloudflare API/MCP (R2 must be enabled on the account first). When the
`infra` Terraform repo lands, import them there.

## Deploy

```sh
bun run deploy   # wrangler deploy
```
