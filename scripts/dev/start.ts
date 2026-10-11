import { type ChildProcess, spawn } from 'node:child_process'
import { join } from 'node:path'
import { createInterface } from 'node:readline'

import { env, warnAboutSentry } from './env'
import { API, AUTH_WORKER, exists, FRONTEND, REPORT_GATE, show, TELEGRAM } from './paths'

type Service = { name: string; cwd: string; command: string[]; env?: Record<string, string> }

const hasAuthWorker = exists(AUTH_WORKER)
const hasReportGate = exists(REPORT_GATE)

// Distinct inspector ports throughout: wrangler processes starting together race for 9229.

// Its own process, because the frontend calls its sign-in API directly and only the first config
// of a multi-config `wrangler dev` serves HTTP. The API's AUTH binding finds it through wrangler's
// local dev registry.
const authWorker: Service = {
    name: 'auth',
    cwd: AUTH_WORKER,
    command: ['bun', 'run', 'dev', '--inspector-port', '9230'],
}

// report-gate and telegram-worker run inside the API's wrangler process, reached through its bindings.
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
    // Explicit, so a stale .env can't point the frontend elsewhere. An empty auth URL hides sign-in.
    env: {
        VITE_API_URL: 'http://localhost:8787',
        VITE_AUTH_URL: hasAuthWorker ? 'http://localhost:8788' : '',
    },
}

env()
warnAboutSentry()
if (!hasAuthWorker) console.warn(`No auth-worker at ${show(AUTH_WORKER)}: sign-in is hidden`)
if (!hasReportGate) console.warn(`No report-gate at ${show(REPORT_GATE)}: reports are accepted without scoring`)

const children = [...(hasAuthWorker ? [authWorker] : []), api, web].map(start)

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

// Each service gets its own process group, so stopping it also stops what it started (workerd,
// esbuild). Its output is prefixed with its name.
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
