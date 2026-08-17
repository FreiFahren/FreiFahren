import { appendFileSync, existsSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

import { extractWithMistral } from '../src/extractor'

export const EVAL_DIR = join(fileURLToPath(new URL('.', import.meta.url)))

export function loadDevVars(): void {
    const path = join(EVAL_DIR, '..', '.dev.vars')
    if (!existsSync(path)) {
        return
    }
    for (const raw of readFileSync(path, 'utf8').split('\n')) {
        const lineStr = raw.trim()
        if (!lineStr || lineStr.startsWith('#')) {
            continue
        }
        const eq = lineStr.indexOf('=')
        if (eq === -1) {
            continue
        }
        const key = lineStr.slice(0, eq).trim()
        if (!(key in process.env)) {
            process.env[key] = lineStr.slice(eq + 1).trim()
        }
    }
}

export async function mapPool<T, R>(
    items: T[],
    limit: number,
    fn: (item: T, i: number) => Promise<R>,
): Promise<R[]> {
    const results = new Array<R>(items.length)
    let next = 0
    const worker = async (): Promise<void> => {
        for (;;) {
            const i = next++
            if (i >= items.length) {
                return
            }
            results[i] = await fn(items[i], i)
        }
    }
    await Promise.all(Array.from({ length: Math.max(1, Math.min(limit, items.length)) }, worker))
    return results
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms))

export async function extractWithRetry(
    text: string,
    systemPrompt: string,
    apiKey: string,
    model: string,
    attempts = 7,
): Promise<Awaited<ReturnType<typeof extractWithMistral>>> {
    let last: unknown
    for (let i = 0; i < attempts; i++) {
        try {
            return await extractWithMistral(text, systemPrompt, apiKey, model)
        } catch (exc) {
            last = exc
            const msg = exc instanceof Error ? exc.message : String(exc)
            if (!/\b429\b|\b5\d\d\b|timeout|timed out|fetch failed|network|ECONNRESET/i.test(msg)) {
                throw exc
            }
            await sleep(Math.min(20000, 1000 * 2 ** i) + Math.floor(Math.random() * 400))
        }
    }
    throw last
}

export function loadJsonlIds(path: string): Set<string> {
    const last = new Map<string, { error?: string | null }>()
    if (!existsSync(path)) {
        return new Set()
    }
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line.trim()) {
            continue
        }
        const row = JSON.parse(line) as { id?: string; error?: string | null }
        if (typeof row.id === 'string') {
            last.set(row.id, row)
        }
    }
    const ids = new Set<string>()
    for (const [id, row] of last) {
        if (row.error == null || row.error === '') {
            ids.add(id)
        }
    }
    return ids
}

export function readJsonl<T>(path: string): T[] {
    if (!existsSync(path)) {
        return []
    }
    const rows: T[] = []
    for (const line of readFileSync(path, 'utf8').split('\n')) {
        if (!line.trim()) {
            continue
        }
        rows.push(JSON.parse(line) as T)
    }
    return rows
}

export function appendJsonl(path: string, row: unknown): void {
    appendFileSync(path, `${JSON.stringify(row)}\n`)
}
