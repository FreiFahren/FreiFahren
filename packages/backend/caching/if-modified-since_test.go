package caching

import (
	"testing"
	"time"
)

func TestCheckIfModifiedSince(t *testing.T) {
	lastModifiedTime, _ := time.Parse(time.RFC1123, "Mon, 01 Jan 2024 12:00:00 GMT")

	tests := []struct {
		name             string
		ifModifiedSince  string
		lastModified     time.Time
		expectedModified bool
		expectError      bool
	}{
		{
			name:             "Empty If-Modified-Since header",
			ifModifiedSince:  "",
			lastModified:     lastModifiedTime,
			expectedModified: true,
			expectError:      false,
		},
		{
			name:             "Correct header, not modified",
			ifModifiedSince:  "Mon, 01 Jan 2024 12:00:00 GMT",
			lastModified:     lastModifiedTime,
			expectedModified: false,
			expectError:      false,
		},
		{
			name:             "Correct header, modified",
			ifModifiedSince:  "Sun, 31 Dec 2023 11:00:00 GMT",
			lastModified:     lastModifiedTime,
			expectedModified: true,
			expectError:      false,
		},
		{
			name:             "Incorrect header format",
			ifModifiedSince:  "01-01-2024 12:00:00",
			lastModified:     lastModifiedTime,
			expectedModified: true,
			expectError:      true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			modified, err := CheckIfModifiedSince(tt.ifModifiedSince, tt.lastModified)
			if (err != nil) != tt.expectError {
				t.Errorf("CheckIfModifiedSince() error = %v, expectError %v", err, tt.expectError)
			}
			if modified != tt.expectedModified {
				t.Errorf("CheckIfModifiedSince() = %v, expected %v", modified, tt.expectedModified)
			}
		})
	}
}
