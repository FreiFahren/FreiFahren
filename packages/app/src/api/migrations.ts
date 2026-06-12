import AsyncStorage from '@react-native-async-storage/async-storage'

const MIGRATION_KEY = 'api_migration_hono_v0'
const OLD_ENDPOINTS = ['/v0/lines', '/v0/stations', '/v0/lines/segments']

/**
 * Clears the etag cache for old endpoint paths that have been migrated to new routes.
 * This migration runs once when the app is updated to use the new Hono backend.
 */
export const runApiMigrations = async (): Promise<void> => {
    try {
        // Check if migration has already been run
        const migrationComplete = await AsyncStorage.getItem(MIGRATION_KEY)

        if (migrationComplete === 'true') {
            return
        }

        // Clear old etag caches
        const allKeys = await AsyncStorage.getAllKeys()

        // Find all etag keys for the old endpoints
        const oldEtagKeys = allKeys.filter((key) => {
            return OLD_ENDPOINTS.some((endpoint) => {
                const safeEndpoint = endpoint.replace(/[^a-zA-Z0-9]/g, '')

                return key.includes(safeEndpoint)
            })
        })

        if (oldEtagKeys.length > 0) {
            await AsyncStorage.multiRemove(oldEtagKeys)
            // eslint-disable-next-line no-console
            console.log(`[Migration] Cleared ${oldEtagKeys.length} old etag cache entries`)
        }

        // Mark migration as complete
        await AsyncStorage.setItem(MIGRATION_KEY, 'true')
        // eslint-disable-next-line no-console
        console.log('[Migration] API migration to Hono v0 completed')
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[Migration] Failed to run API migrations:', error)
        // Don't throw - we don't want to crash the app if migration fails
    }
}
