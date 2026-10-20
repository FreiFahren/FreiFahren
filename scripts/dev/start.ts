import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { env, warnAboutSentry } from './env'
import { API, AUTH_WORKER, exists, FRONTEND, FUND, REPORT_GATE, show, TELEGRAM } from './paths'

type Service = { name: string; cwd: string; command: string[]; env?: Record<string, string> }

const hasAuthWorker = exists(AUTH_WORKER)
const hasReportGate = exists(REPORT_GATE)
const hasFund = exists(FUND)

// Distinct inspector ports throughout: wrangler processes starting together race for 9229.

// Its own process: only the first config of a multi-config `wrangler dev` serves HTTP, and the
// frontend calls the auth-worker directly. The API's binding finds it through wrangler's dev registry.
const authWorker: Service = {
    name: 'auth',
    cwd: AUTH_WORKER,
    command: ['bun', 'run', 'dev', '--inspector-port', '9230'],
}

// Also its own process, called by the frontend directly; its AUTH binding finds the auth-worker
// the same way the API's does.
const fund: Service = {
    name: 'fund',
    cwd: FUND,
    command: ['bun', 'run', 'dev', '--inspector-port', '9231'],
}

const privateConfigs = hasReportGate
    ? ['-c', join(REPORT_GATE, 'wrangler.jsonc'), '-c', join(TELEGRAM, 'wrangler.jsonc')]
    : []
const api: Service = {
    name: 'api',
    cwd: API,
    command: ['bunx', 'wrangler', 'dev', '--inspector-port', '9229', '-c', 'wrangler.jsonc', ...privateConfigs],
}

const web: Service = {
    name: 'web',
    cwd: FRONTEND,
    command: ['bun', 'run', 'dev'],
    // Overrides a stale .env.
    env: {
        VITE_API_URL: 'http://localhost:8787',
        VITE_AUTH_URL: hasAuthWorker ? 'http://localhost:8788' : '',
        VITE_FUND_URL: hasFund ? 'http://localhost:8789' : '',
    },
}

env()
warnAboutSentry()
if (!hasAuthWorker) console.warn(`No auth-worker at ${show(AUTH_WORKER)}: sign-in is hidden`)
if (!hasFund) console.warn(`No Fund Worker at ${show(FUND)}: the Fund page only shows its pitch`)
if (!hasReportGate) console.warn(`No report-gate at ${show(REPORT_GATE)}: reports are accepted without scoring`)

const children = [...(hasAuthWorker ? [authWorker] : []), ...(hasFund ? [fund] : []), api, web].map(start)

let interrupted = false
for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    process.on(signal, () => {
        interrupted = true
        children.forEach(stop)
    })
}

// One service stopping takes the rest down with it. A crash fails the run; Ctrl-C doesn't.
const firstExitCode = await Promise.race(children.map(exitCode))
children.forEach(stop)
process.exitCode = interrupted ? 0 : firstExitCode

// Own process group, so stopping a service also stops what it started (workerd, esbuild).
function start({ name, cwd, command, env: extra }: Service): ChildProcess {
    const child = spawn(command[0]!, command.slice(1), {
        cwd,
        env: { ...process.env, FORCE_COLOR: '1', ...extra },
        stdio: ['ignore', 'pipe', 'pipe'],
        detached: true,
    })
    for (const output of [child.stdout!, child.stderr!]) {
        createInterface({ input: output }).on('line', (line) => console.log(`[${name}] ${line}`))
    }
    return child
}

function stop(child: ChildProcess) {
    if (child.exitCode !== null || child.pid === undefined) return
    try {
        process.kill(-child.pid, 'SIGTERM')
    } catch {
        // Already gone.
    }
}

function exitCode(child: ChildProcess) {
    return new Promise<number>((done) => child.on('exit', (code) => done(code ?? 1)))
}
