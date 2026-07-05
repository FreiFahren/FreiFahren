import { readFile } from 'node:fs/promises'

import { SEED_CITY } from './config'
import type { OsmSnapshotKind, SnapshotLoader } from './seed'

// Reads the city-namespaced bundled snapshots from disk. For Node/Bun runtimes (the seed CLI)
// only — the Workers test runtime has no filesystem and injects a bundled-import loader instead.
export const fsSnapshotLoader: SnapshotLoader = async <T>(kind: OsmSnapshotKind): Promise<T> => {
    const url = new URL(`./snapshots/${SEED_CITY}/${kind}.json`, import.meta.url)
    try {
        return JSON.parse(await readFile(url, 'utf-8')) as T
    } catch {
        throw new Error(
            `[seed] Bundled '${kind}' snapshot for '${SEED_CITY}' is missing or unreadable. ` +
                `Run \`bun db:seed:refresh --city ${SEED_CITY}\`.`
        )
    }
}
