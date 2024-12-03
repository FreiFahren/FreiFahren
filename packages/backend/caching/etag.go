package caching

import (
	"crypto/sha256"
	"fmt"
	"net/http"
	"sync"
	"time"

	"github.com/FreiFahren/backend/logger"
	"github.com/labstack/echo/v4"
)

type CacheableData interface {
	GetBytes() []byte
}

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

// NewCache creates a new cache instance with the provided data and configuration.
// It generates an initial ETag using SHA-256 hash of the data.
func NewCache(data []byte, config CacheConfig) *Cache {
	hash := sha256.Sum256(data)
	return &Cache{
		data:        data,
		etag:        fmt.Sprintf(`"%x"`, hash[:4]),
		contentType: config.ContentTypeInMIME,
		maxAge:      config.MaxAgeInSeconds,
		lastUpdated: time.Now(),
	}
}

// Update updates the cached data and generates a new ETag.
// This is thread-safe and should be used when the underlying data changes.
func (c *Cache) Update(newData []byte) {
	c.lock.Lock()
	defer c.lock.Unlock()

	c.data = newData
	hash := sha256.Sum256(newData)
	c.etag = fmt.Sprintf(`"%x"`, hash[:4])
	c.lastUpdated = time.Now()
}

// Get retrieves the current state of the cache.
// Returns the data, its ETag, and last modification time.
func (c *Cache) Get() ([]byte, string, time.Time) {
	c.lock.RLock()
	defer c.lock.RUnlock()

	return c.data, c.etag, c.lastUpdated
}

// ETagMiddleware creates an Echo middleware that implements HTTP caching using ETags.
//
// This middleware:
// 1. Generates and manages ETags for cached content
// 2. Handles conditional requests (If-None-Match, If-Modified-Since)
// 3. Returns 304 Not Modified when appropriate
// 4. Sets proper cache headers (Cache-Control, ETag, Last-Modified)
//
// The caching strategy:
// - ETags are generated using SHA-256 hash of the content
// - Last-Modified dates are tracked for each update
// - Clients can use If-None-Match for ETag-based validation
// - Clients can use If-Modified-Since for date-based validation
// - Cache-Control headers guide client-side caching behavior
//
// Example usage:
//
//	e.GET("/api/data", handler, cache.ETagMiddleware())
//
// Returns:
// - 200 OK with data if content is modified or not in client cache
// - 304 Not Modified if client has current version
// - 500 Internal Server Error if no data is available
func (c *Cache) ETagMiddleware() echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(ctx echo.Context) error {
			data, etag, lastModified := c.Get()

			if len(data) == 0 {
				return ctx.JSON(http.StatusInternalServerError, map[string]string{
					"error": "Internal Server Error: No data available",
				})
			}

			// Check If-None-Match header
			if clientETag := ctx.Request().Header.Get("If-None-Match"); clientETag == etag {
				logger.Log.Debug().
					Str("path", ctx.Path()).
					Str("etag", etag).
					Msg("returning 304 Not Modified (ETag match)")
				return ctx.NoContent(http.StatusNotModified)
			}

			// Check If-Modified-Since header
			if ifModifiedSince := ctx.Request().Header.Get("If-Modified-Since"); ifModifiedSince != "" {
				if modifiedSince, err := time.Parse(time.RFC1123, ifModifiedSince); err == nil {
					if lastModified.Before(modifiedSince) {
						logger.Log.Debug().
							Str("path", ctx.Path()).
							Time("lastModified", lastModified).
							Msg("returning 304 Not Modified (date check)")
						return ctx.NoContent(http.StatusNotModified)
					}
				}
			}

			// Set cache headers
			ctx.Response().Header().Set("Cache-Control", fmt.Sprintf("public, max-age=%d", c.maxAge))
			ctx.Response().Header().Set("ETag", etag)
			ctx.Response().Header().Set("Last-Modified", lastModified.UTC().Format(time.RFC1123))
			ctx.Response().Header().Set("Content-Type", c.contentType)

			logger.Log.Debug().
				Str("path", ctx.Path()).
				Str("etag", etag).
				Time("lastModified", lastModified).
				Msg("serving cached content")

			return ctx.Blob(http.StatusOK, c.contentType, data)
		}
	}
}
