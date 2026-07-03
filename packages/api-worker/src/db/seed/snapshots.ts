import { readFile } from 'node:fs/promises'

import type { OsmSnapshotKind, SnapshotLoader } from './seed'

// Reads the bundled snapshots from disk. For Node/Bun runtimes (the seed CLI) only —
// The Workers test runtime has no filesystem and injects a bundled-import loader instead.
export const fsSnapshotLoader: SnapshotLoader = async <T>(kind: OsmSnapshotKind): Promise<T> => {
    const url = new URL(`./snapshots/${kind}.json`, import.meta.url)
    try {
        return JSON.parse(await readFile(url, 'utf-8')) as T
    } catch {
        throw new Error(`[seed] Bundled '${kind}' snapshot is missing or unreadable. Run \`bun db:seed:refresh\`.`)
    }
}
