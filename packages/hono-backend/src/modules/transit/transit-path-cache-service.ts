import { existsSync, mkdirSync } from 'fs'
import { readFile, writeFile } from 'fs/promises'
import { join } from 'path'

import { findPathWithAStar, type Graph } from './pathfinding'

export type PathCacheKey = `${string}:${string}`

type CacheMetadata = {
    version: number
    stationCount: number
    computedAt: string
}

type CacheFile = {
    metadata: CacheMetadata
    paths: Record<PathCacheKey, number>
}

const CACHE_VERSION = 1
const CACHE_DIR = join(process.cwd(), '.cache')
const CACHE_FILE = join(CACHE_DIR, 'transit-paths-cache.json')

export class TransitPathCacheService {
    private pathCache = new Map<PathCacheKey, number>()
    private isPrecomputing = false

    constructor() {
        if (!existsSync(CACHE_DIR)) {
            mkdirSync(CACHE_DIR, { recursive: true })
        }
    }

    get(key: PathCacheKey): number | undefined {
        return this.pathCache.get(key)
    }

    set(key: PathCacheKey, value: number): void {
        this.pathCache.set(key, value)
    }

    has(key: PathCacheKey): boolean {
        return this.pathCache.has(key)
    }

    size(): number {
        return this.pathCache.size
    }

    async loadFromDisk(graph: Graph): Promise<boolean> {
        try {
            if (!existsSync(CACHE_FILE)) {
                console.log('cache file not found, will pre-compute paths')
                return false
            }

            const fileContent = await readFile(CACHE_FILE, 'utf-8')
            const cacheData: CacheFile = JSON.parse(fileContent)

            if (
                cacheData.metadata.version !== CACHE_VERSION ||
                cacheData.metadata.stationCount !== graph.stations.size
            ) {
                console.log(
                    `cache invalid (version: ${cacheData.metadata.version}, station count: ${cacheData.metadata.stationCount}), will recompute`
                )
                return false
            }

            for (const [key, value] of Object.entries(cacheData.paths)) {
                this.pathCache.set(key as PathCacheKey, value)
            }

            const computedAt = new Date(cacheData.metadata.computedAt).toLocaleString()
            console.log(
                `loaded ${this.pathCache.size} pre-computed paths from cache (computed at: ${computedAt})`
            )
            return true
        } catch (error) {
            console.error('error loading cache from disk:', error)
            return false
        }
    }

    async saveToDisk(graph: Graph): Promise<void> {
        try {
            const stationCount = graph.stations.size
            const cacheData: CacheFile = {
                metadata: {
                    version: CACHE_VERSION,
                    stationCount,
                    computedAt: new Date().toISOString(),
                },
                paths: Object.fromEntries(this.pathCache),
            }

            await writeFile(CACHE_FILE, JSON.stringify(cacheData, null, 2))
            console.log(`saved ${this.pathCache.size} paths to cache file: ${CACHE_FILE}`)
        } catch (error) {
            console.error('error saving cache to disk:', error)
        }
    }

    async precomputeAllPaths(graph: Graph): Promise<void> {
        if (this.isPrecomputing) {
            return
        }

        this.isPrecomputing = true
        const stationIds = Array.from(graph.stations.keys())
        const totalPairs = stationIds.length * (stationIds.length - 1)
        let computed = 0
        const startTime = Date.now()
        const YIELD_INTERVAL = 100

        console.log(`starting pre-computation of ${totalPairs} station pairs...`)

        for (const from of stationIds) {
            for (const to of stationIds) {
                if (from === to) {
                    continue
                }

                const cacheKey: PathCacheKey = `${from}:${to}`

                if (this.pathCache.has(cacheKey)) {
                    computed++
                    continue
                }

                try {
                    const distance = findPathWithAStar(graph, from, to)
                    this.pathCache.set(cacheKey, distance)
                    computed++

                    if (computed % YIELD_INTERVAL === 0) {
                        await new Promise((resolve) => setImmediate(resolve))
                    }

                    if (computed % Math.max(1, Math.floor(totalPairs / 10)) === 0) {
                        const progress = ((computed / totalPairs) * 100).toFixed(1)
                        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
                        console.log(
                            `pre-computation progress: ${progress}% (${computed}/${totalPairs} pairs, ${elapsed}s elapsed)`
                        )
                    }
                } catch (error) {
                    if (error instanceof Error && error.message.includes('No path found')) {
                        continue
                    }
                    throw error
                }
            }
        }

        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
        console.log(
            `pre-computation complete: ${computed} paths computed in ${elapsed}s (${this.pathCache.size} total entries)`
        )

        await this.saveToDisk(graph)

        this.isPrecomputing = false
    }
}

