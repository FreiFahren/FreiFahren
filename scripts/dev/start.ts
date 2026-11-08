import { type ChildProcess, spawn } from 'node:child_process'
import { createInterface } from 'node:readline'

import { env, warnAboutSentry } from './env'
import { API, FRONTEND } from './paths'

export type Service = { name: string; cwd: string; command: string[]; env?: Record<string, string> }

/*
 * The private services FreiFahren runs next to this repository's. Without them, sign-in and the
 * Fund are hidden and reports are accepted unscored.
 */
export type PrivateServices = {
    // Started as their own processes, before the API and the frontend. Workers find each other's
    // service bindings through wrangler's local dev registry.
    services: Service[]
    // Their Worker directories, given local env files like this repository's Workers.
    workers: string[]
    // Where the frontend finds the services it calls directly.
    webEnv: Record<string, string>
}

export async function dev(privateServices?: PrivateServices) {
    // Distinct inspector ports throughout: wrangler processes starting together race for 9229.
    const api: Service = {
        name: 'api',
        cwd: API,
        command: [
            'bunx',
            'wrangler',
            'dev',
            '--inspector-port',
            '9229',
            // The API's REPORT_GATE binding points at the private report-gate either way; without it,
            // this mode accepts reports unscored, as pull request previews do.
            ...(privateServices ? [] : ['--var', 'REPORT_GATE_MODE:preview-open']),
        ],
    }

    const web: Service = {
        name: 'web',
        cwd: FRONTEND,
        command: ['bun', 'run', 'dev'],
        // Overrides a stale .env.
        env: {
            VITE_API_URL: 'http://localhost:8787',
            VITE_AUTH_URL: '',
            VITE_FUND_URL: '',
            ...privateServices?.webEnv,
        },
    }

    env(privateServices?.workers)
    warnAboutSentry(privateServices?.workers)
    if (!privateServices) {
        console.warn(
            'Running without the private services: sign-in and the Fund are hidden, and reports are accepted unscored'
        )
    }

    const children = [...(privateServices?.services ?? []), api, web].map(start)

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
}

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

if (import.meta.main) await dev()
