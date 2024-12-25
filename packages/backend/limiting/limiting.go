package limiting

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"github.com/FreiFahren/backend/logger"
)

type RateLimiter struct {
	mu          sync.RWMutex
	submissions map[string]time.Time
	salt        string
}

var GlobalRateLimiter = NewRateLimiter()

func generateSalt() string {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		logger.Log.Error().Err(err).Msg("Failed to generate salt, using timestamp as fallback")
		return time.Now().String()
	}
	return hex.EncodeToString(bytes)
}

func NewRateLimiter() *RateLimiter {
	return &RateLimiter{
		submissions: make(map[string]time.Time),
		salt:        generateSalt(), // Generate a new salt on startup
	}
}

func (r *RateLimiter) hashIP(ip string) string {
	hasher := sha256.New()
	// Combine IP and salt before hashing to make it harder to reverse
	hasher.Write([]byte(ip + r.salt))
	return hex.EncodeToString(hasher.Sum(nil))
}

func (r *RateLimiter) CanSubmitReport(ip string) bool {
	r.mu.RLock()
	defer r.mu.RUnlock()

	hashedIP := r.hashIP(ip)
	lastSubmission, exists := r.submissions[hashedIP]

	if !exists {
		return true
	}

	if time.Since(lastSubmission) > 30*time.Minute {
		return true
	}

	logger.Log.Info().
		Msg("Blocked IP from submitting report")
	return false
}

func (r *RateLimiter) RecordSubmission(ip string) {
	r.mu.Lock()
	defer r.mu.Unlock()

	hashedIP := r.hashIP(ip)
	r.submissions[hashedIP] = time.Now()
}

func (r *RateLimiter) CleanupOldSubmissions() {
	r.mu.Lock()
	defer r.mu.Unlock()

	threshold := time.Now().Add(-30 * time.Minute)

	for ip, timestamp := range r.submissions {
		if timestamp.Before(threshold) {
			delete(r.submissions, ip)
			logger.Log.Debug().
				Str("hashedIP", ip).
				Msg("Removed expired rate limit entry")
		}
	}
}
