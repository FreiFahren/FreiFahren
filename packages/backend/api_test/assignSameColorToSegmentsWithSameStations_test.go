package api_test

import (
	"reflect"
	"testing"

	"github.com/FreiFahren/backend/api"
)

func TestAssignSameColorToSegmentsWithMatchingTypes(t *testing.T) {
	segmentColorsMap := map[string]string{
		"A1": "red",
		"B2": "blue",
	}
	duplicates := map[string][]string{
		"A1": {"A3", "A4"},
		"B2": {"B5"},
	}

	expected := map[string]string{
		"A1": "red",
		"A3": "red",
		"A4": "red",
		"B2": "blue",
		"B5": "blue",
	}

	api.AssignSameColorToSegmentsWithSameStations(segmentColorsMap, duplicates)

	if !reflect.DeepEqual(segmentColorsMap, expected) {
		t.Errorf("Expected %v, but got %v", expected, segmentColorsMap)
	}
}

func TestAssignSameColorToSegmentsOriginalNotFound(t *testing.T) {
	segmentColorsMap := map[string]string{
		"B2": "blue",
	}
	duplicates := map[string][]string{
		"A1": {"A3", "A4"},
		"B2": {"B5"},
	}

	expected := map[string]string{
		"B2": "blue",
		"B5": "blue",
	}

	api.AssignSameColorToSegmentsWithSameStations(segmentColorsMap, duplicates)

	if !reflect.DeepEqual(segmentColorsMap, expected) {
		t.Errorf("Expected %v, but got %v", expected, segmentColorsMap)
	}
}

func TestDoesNotChangeColorsOfSegmentsNotListedInDuplicates(t *testing.T) {
	segmentColorsMap := map[string]string{
		"A1": "red",
		"B2": "blue",
	}
	duplicates := map[string][]string{
		"A1": {"A3", "A4"},
		"B2": {"B5"},
	}

	expected := map[string]string{
		"A1": "red",
		"A3": "red",
		"A4": "red",
		"B2": "blue",
		"B5": "blue",
	}

	api.AssignSameColorToSegmentsWithSameStations(segmentColorsMap, duplicates)

	if !reflect.DeepEqual(segmentColorsMap, expected) {
		t.Errorf("Expected %v, but got %v", expected, segmentColorsMap)
	}
}

// handles multiple duplicates for a single original segment
func TestAssignSameColorToSegmentsWithMultipleDuplicates(t *testing.T) {
	segmentColorsMap := map[string]string{
		"A1": "red",
		"B2": "blue",
	}
	duplicates := map[string][]string{
		"A1": {"A3", "A4"},
		"B2": {"B5", "B6"},
	}

	expected := map[string]string{
		"A1": "red",
		"A3": "red",
		"A4": "red",
		"B2": "blue",
		"B5": "blue",
		"B6": "blue",
	}

	api.AssignSameColorToSegmentsWithSameStations(segmentColorsMap, duplicates)

	if !reflect.DeepEqual(segmentColorsMap, expected) {
		t.Errorf("Expected %v, but got %v", expected, segmentColorsMap)
	}
}

func TestAssignSameColorToSegmentsWithEmptyDuplicatesArray(t *testing.T) {
	segmentColorsMap := map[string]string{
		"A1": "red",
		"B2": "blue",
	}
	duplicates := map[string][]string{
		"B3": {},
		"A4": {},
	}

	expected := map[string]string{
		"A1": "red",
		"B2": "blue",
	}

	api.AssignSameColorToSegmentsWithSameStations(segmentColorsMap, duplicates)

	if !reflect.DeepEqual(segmentColorsMap, expected) {
		t.Errorf("Expected %v, but got %v", expected, segmentColorsMap)
	}
}
