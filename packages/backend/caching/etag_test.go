package caching

import (
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/labstack/echo/v4"
	"github.com/stretchr/testify/assert"
)

func TestCache(t *testing.T) {
	// Test data
	testData := []byte(`{"test": "data"}`)
	config := CacheConfig{
		MaxAgeInSeconds:   3600,
		ContentTypeInMIME: "application/json",
	}

	t.Run("NewCache initialization", func(t *testing.T) {
		cache := NewCache(testData, config)
		assert.NotNil(t, cache)
		assert.Equal(t, config.ContentTypeInMIME, cache.contentType)
		assert.Equal(t, config.MaxAgeInSeconds, cache.maxAge)
		assert.NotEmpty(t, cache.etag)
	})

	t.Run("Cache Update", func(t *testing.T) {
		cache := NewCache(testData, config)
		originalETag := cache.etag

		newData := []byte(`{"updated": "data"}`)
		cache.Update(newData)

		assert.NotEqual(t, originalETag, cache.etag)
		data, _, _ := cache.Get()
		assert.Equal(t, newData, data)
	})

	t.Run("ETagMiddleware basic response", func(t *testing.T) {
		// Setup
		e := echo.New()
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		cache := NewCache(testData, config)
		handler := cache.ETagMiddleware()(func(c echo.Context) error {
			return nil
		})

		// Test
		err := handler(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, rec.Code)
		assert.Equal(t, config.ContentTypeInMIME, rec.Header().Get("Content-Type"))
		assert.NotEmpty(t, rec.Header().Get("ETag"))
		assert.NotEmpty(t, rec.Header().Get("Last-Modified"))
		assert.Contains(t, rec.Header().Get("Cache-Control"), "public")
		assert.Contains(t, rec.Header().Get("Cache-Control"), "max-age=3600")
	})

	t.Run("ETagMiddleware If-None-Match", func(t *testing.T) {
		// Setup
		e := echo.New()
		cache := NewCache(testData, config)
		_, etag, _ := cache.Get()

		// Test matching ETag
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("If-None-Match", etag)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		handler := cache.ETagMiddleware()(func(c echo.Context) error {
			return nil
		})

		err := handler(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusNotModified, rec.Code)
		assert.Empty(t, rec.Body.String())

		// Test non-matching ETag
		req = httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("If-None-Match", `"different-etag"`)
		rec = httptest.NewRecorder()
		c = e.NewContext(req, rec)

		err = handler(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, rec.Code)
		assert.NotEmpty(t, rec.Body.String())
	})

	t.Run("ETagMiddleware If-Modified-Since", func(t *testing.T) {
		// Setup
		e := echo.New()
		cache := NewCache(testData, config)

		// Test future date
		futureTime := time.Now().Add(time.Hour).Format(time.RFC1123)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("If-Modified-Since", futureTime)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		handler := cache.ETagMiddleware()(func(c echo.Context) error {
			return nil
		})

		err := handler(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusNotModified, rec.Code)

		// Test past date
		pastTime := time.Now().Add(-time.Hour).Format(time.RFC1123)
		req = httptest.NewRequest(http.MethodGet, "/", nil)
		req.Header.Set("If-Modified-Since", pastTime)
		rec = httptest.NewRecorder()
		c = e.NewContext(req, rec)

		err = handler(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusOK, rec.Code)
	})

	t.Run("Empty cache data", func(t *testing.T) {
		// Setup
		e := echo.New()
		cache := NewCache([]byte{}, config)
		req := httptest.NewRequest(http.MethodGet, "/", nil)
		rec := httptest.NewRecorder()
		c := e.NewContext(req, rec)

		handler := cache.ETagMiddleware()(func(c echo.Context) error {
			return nil
		})

		err := handler(c)
		assert.NoError(t, err)
		assert.Equal(t, http.StatusInternalServerError, rec.Code)
		assert.Contains(t, rec.Body.String(), "No data available")
	})
}
