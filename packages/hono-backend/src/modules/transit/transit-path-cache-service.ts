import { findPathWithAStar, StationId, type Graph } from './pathfinding'

export type PathCacheKey = `${string}:${string}`

export class TransitPathCacheService {
    private pathCache = new Map<PathCacheKey, number>()

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

    getOrCompute(graph: Graph, from: StationId, to: StationId): number {
        const key: PathCacheKey = `${from}:${to}`
        const cached = this.pathCache.get(key)
        if (cached !== undefined) {
            return cached
        }

        const distance = findPathWithAStar(graph, from, to)
        this.pathCache.set(key, distance)
        return distance
    }
}
