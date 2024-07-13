package test_postInspector

import (
	"reflect"
	"testing"

	"github.com/FreiFahren/backend/api/postInspector"
	"github.com/FreiFahren/backend/utils"
)

func TestAssignLineIfSingleOption(t *testing.T) {
	cases := []struct {
		name           string
		dataToInsert   utils.ResponseData
		pointers       utils.InsertPointers
		station        utils.StationListEntry
		direction      utils.StationListEntry
		expectedLine   string
		expectedPtrNil bool
	}{
		{
			name: "Single line at station",
			dataToInsert: utils.ResponseData{
				Station: utils.Station{Lines: []string{"Line1"}},
			},
			station: utils.StationListEntry{
				Lines: []string{"Line1"},
			},
			direction: utils.StationListEntry{
				Lines: []string{},
			},
			expectedLine:   "Line1",
			expectedPtrNil: false,
		},
		{
			name: "Single line at direction",
			dataToInsert: utils.ResponseData{
				Direction: utils.Station{Lines: []string{"Line2"}},
			},
			station: utils.StationListEntry{
				Lines: []string{"Line1", "Line3"},
			},
			direction: utils.StationListEntry{
				Lines: []string{"Line2"},
			},
			expectedLine:   "Line2",
			expectedPtrNil: false,
		},
		{
			name: "Multiple lines at station and direction",
			dataToInsert: utils.ResponseData{
				Station:   utils.Station{Lines: []string{"Line1", "Line2"}},
				Direction: utils.Station{Lines: []string{"Line3", "Line4"}},
			},
			station: utils.StationListEntry{
				Lines: []string{"Line1", "Line2"},
			},
			direction: utils.StationListEntry{
				Lines: []string{"Line3", "Line4"},
			},
			expectedLine:   "",
			expectedPtrNil: true,
		},
		{
			name: "No lines at station or direction",
			dataToInsert: utils.ResponseData{
				Station:   utils.Station{Lines: []string{}},
				Direction: utils.Station{Lines: []string{}},
			},
			station: utils.StationListEntry{
				Lines: []string{},
			},
			direction: utils.StationListEntry{
				Lines: []string{},
			},
			expectedLine:   "",
			expectedPtrNil: true,
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			pointers := &utils.InsertPointers{}

			err := postInspector.AssignLineIfSingleOption(&tc.dataToInsert, pointers, tc.station, tc.direction)
			if err != nil {
				t.Errorf("Unexpected error: %v", err)
			}

			if tc.dataToInsert.Line != tc.expectedLine {
				t.Errorf("Expected line %v, got %v", tc.expectedLine, tc.dataToInsert.Line)
			}

			if (pointers.LinePtr == nil) != tc.expectedPtrNil {
				t.Errorf("Expected pointer nil %v, got %v", tc.expectedPtrNil, reflect.ValueOf(pointers.LinePtr).IsNil())
			}
		})
	}
}
