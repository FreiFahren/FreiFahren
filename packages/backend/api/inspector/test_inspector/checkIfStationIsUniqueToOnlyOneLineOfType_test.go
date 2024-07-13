package test_inspector

import (
	"testing"

	"github.com/FreiFahren/backend/api/inspector"
	"github.com/FreiFahren/backend/utils"
	"github.com/stretchr/testify/assert"
)

func TestCheckIfStationIsUniqueToOneLineOfType(t *testing.T) {
	cases := []struct {
		name     string
		station  utils.StationListEntry
		line     string
		expected bool
	}{
		{
			name: "Station uniquely served by one 'U' line",
			station: utils.StationListEntry{
				Lines: []string{"U3"},
			},
			line:     "U3",
			expected: true,
		},
		{
			name: "Station served by multiple 'U' lines",
			station: utils.StationListEntry{
				Lines: []string{"U3", "U1"},
			},
			line:     "U3",
			expected: false,
		},
		{
			name: "Station uniquely served by one 'S' line",
			station: utils.StationListEntry{
				Lines: []string{"S1"},
			},
			line:     "S1",
			expected: true,
		},
		{
			name: "Station served by 'S' and 'U' lines, unique in 'S'",
			station: utils.StationListEntry{
				Lines: []string{"S1", "U2"},
			},
			line:     "S1",
			expected: true,
		},
		{
			name: "Station served by 'S' and 'U' lines, not unique in 'S'",
			station: utils.StationListEntry{
				Lines: []string{"S1", "S3", "U2"},
			},
			line:     "S1",
			expected: false,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			result := inspector.CheckIfStationIsUniqueToOneLineOfType(tc.station, tc.line)
			assert.Equal(t, tc.expected, result, "Expected and actual results should match")
		})
	}
}
