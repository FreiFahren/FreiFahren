package caching

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestCacheManager(t *testing.T) {
	t.Run("InitCacheManager", func(t *testing.T) {
		InitCacheManager()
		assert.NotNil(t, GlobalCacheManager)
		assert.NotNil(t, GlobalCacheManager.caches)
	})

	t.Run("Register and Get cache", func(t *testing.T) {
		// Setup
		InitCacheManager()
		testData := []byte(`{"test": "data"}`)
		config := CacheConfig{
			MaxAgeInSeconds:   3600,
			ContentTypeInMIME: "application/json",
		}

		// Test registration
		cache := GlobalCacheManager.Register("test", testData, config)
		assert.NotNil(t, cache)

		// Test retrieval
		retrievedCache, exists := GlobalCacheManager.Get("test")
		assert.True(t, exists)
		assert.Equal(t, cache, retrievedCache)

		// Test non-existent cache
		_, exists = GlobalCacheManager.Get("nonexistent")
		assert.False(t, exists)
	})

	t.Run("Replace existing cache", func(t *testing.T) {
		// Setup
		InitCacheManager()
		testData1 := []byte(`{"test": "data1"}`)
		testData2 := []byte(`{"test": "data2"}`)
		config := CacheConfig{
			MaxAgeInSeconds:   3600,
			ContentTypeInMIME: "application/json",
		}

		// Register initial cache
		cache1 := GlobalCacheManager.Register("test", testData1, config)

		// Replace with new cache
		cache2 := GlobalCacheManager.Register("test", testData2, config)

		// Verify replacement
		retrievedCache, exists := GlobalCacheManager.Get("test")
		assert.True(t, exists)
		assert.Equal(t, cache2, retrievedCache)
		assert.NotEqual(t, cache1, retrievedCache)

		// Verify data
		data, _, _ := retrievedCache.Get()
		assert.Equal(t, testData2, data)
	})
}
