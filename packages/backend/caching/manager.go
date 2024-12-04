package caching

import (
	"sync"
	"time"
)

type CacheConfig struct {
	MaxAgeInSeconds   int
	ContentTypeInMIME string
}

// Cache manages cached data with thread-safe operations
type Cache struct {
	data        []byte
	etag        string
	contentType string
	maxAge      int
	lastUpdated time.Time
	lock        sync.RWMutex
}

// GlobalCacheManager is the singleton instance of CacheManager used across the application
var GlobalCacheManager *CacheManager

// CacheManager provides a centralized way to manage multiple named caches.
// It ensures thread-safe access to cache instances and provides a simple API
// for registering and retrieving caches.
//
// The manager is designed to:
// 1. Maintain a single source of truth for all caches
// 2. Provide thread-safe access to cache instances
// 3. Allow dynamic registration of new caches
// 4. Support multiple content types and caching strategies
type CacheManager struct {
	caches map[string]*Cache
	lock   sync.RWMutex
}

// InitCacheManager initializes the global cache manager instance.
// This should be called during application startup, before any cache operations.
//
// Example usage:
//
//	func main() {
//	    caching.InitCacheManager()
//	    // ... rest of application setup
//	}
func InitCacheManager() {
	GlobalCacheManager = &CacheManager{
		caches: make(map[string]*Cache),
	}
}

// Register adds a new cache instance to the manager with the specified name.
// If a cache with the same name already exists, it will be replaced.
//
// Parameters:
// - name: A unique identifier for the cache
// - data: The initial data to cache
// - config: Configuration for the cache including max age and content type
//
// Returns:
// - *Cache: The newly created cache instance
//
// Example usage:
//
//	cache := manager.Register("userList", userData, CacheConfig{
//	    MaxAgeInSeconds: 3600,
//	    ContentTypeInMIME: "application/json",
//	})
func (cm *CacheManager) Register(name string, data []byte, config CacheConfig) *Cache {
	cm.lock.Lock()
	defer cm.lock.Unlock()

	cache := NewCache(data, config)
	cm.caches[name] = cache
	return cache
}

// Get retrieves a cache instance by its name.
// This method is thread-safe and can be called concurrently.
//
// Parameters:
// - name: The identifier of the cache to retrieve
//
// Returns:
// - *Cache: The cache instance if found
// - bool: true if the cache exists, false otherwise
//
// Example usage:
//
//	if cache, exists := manager.Get("userList"); exists {
//	    // Use the cache
//	} else {
//	    // Handle cache miss
//	}
func (cm *CacheManager) Get(name string) (*Cache, bool) {
	cm.lock.RLock()
	defer cm.lock.RUnlock()

	cache, exists := cm.caches[name]
	return cache, exists
}
