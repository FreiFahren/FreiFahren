from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
import json
import logging
import sys
import os
from dataclasses import dataclass

# Configure logging to write to stderr
logging.basicConfig(
    level=logging.DEBUG, format="PYTHON_DEBUG: %(message)s", stream=sys.stderr
)
logger = logging.getLogger(__name__)


@dataclass
class Report:
    station_id: str
    timestamp: datetime
    direction_id: Optional[str]
    lines: List[str]


@dataclass
class Segment:
    sid: str
    line_id: str
    from_station_id: str
    to_station_id: str


class RiskPredictor:
    def __init__(self, segments: List[Segment]):
        """
        Initialize the risk prediction model.

        Args:
            segments: List of transport line segments
        """
        self.segments = segments
        self.colors = [
            "#13C184",  # Green (default/no risk)
            "#FACB3F",  # Yellow (low risk)
            "#F05044",  # Red (medium risk)
            "#A92725",  # Dark Red (high risk)
        ]

        # Create a mapping of ordered station pairs -> list of segments
        self.overlapping_segments: Dict[Tuple[str, str], List[Segment]] = {}
        for segment in segments:
            # Order station IDs alphabetically to handle bidirectional segments
            stations = sorted([segment.from_station_id, segment.to_station_id])
            key = (stations[0], stations[1])
            if key not in self.overlapping_segments:
                self.overlapping_segments[key] = []
            self.overlapping_segments[key].append(segment)
        logger.debug("Initialized RiskPredictor")

    def predict(self, reports: List[Report]) -> Dict[str, str]:
        # Initialize risk values for all segments
        segment_risks: Dict[str, float] = {
            segment.sid: 0.0 for segment in self.segments
        }

        # Calculate initial risks based on reports and line matches
        for report in reports:
            if not report.lines:
                continue

            risk_per_line = 1.0 / len(report.lines)

            # Assign risk to all segments matching the lines in the report
            for segment in self.segments:
                if segment.line_id in report.lines:
                    # Sum up risks from multiple reports
                    segment_risks[segment.sid] = min(
                        1.0, segment_risks[segment.sid] + risk_per_line
                    )

        # Now propagate risks to overlapping segments
        final_risks: Dict[str, float] = segment_risks.copy()

        # For each segment that has a risk
        for sid, risk in segment_risks.items():
            if risk > 0:
                # Find the segment
                segment = next(s for s in self.segments if s.sid == sid)
                # Get its ordered station pair
                stations = sorted([segment.from_station_id, segment.to_station_id])
                key = (stations[0], stations[1])

                # Propagate its risk to all segments sharing these stations
                for overlapping_segment in self.overlapping_segments[key]:
                    current_risk = final_risks[overlapping_segment.sid]
                    final_risks[overlapping_segment.sid] = max(current_risk, risk)

        # Convert risks to colors
        segment_colors = {}
        for sid, risk in final_risks.items():
            color = self._risk_to_color(risk)
            if color != self.colors[0]:  # Only include segments with risk
                segment_colors[sid] = color

        return segment_colors

    def _risk_to_color(self, risk: float) -> str:
        """Convert risk score to color code."""
        if risk <= 0.1:
            return self.colors[0]
        elif risk >= 0.7:
            return self.colors[-1]

        if risk < 0.3:
            return self.colors[1]  # Yellow
        elif risk < 0.7:
            return self.colors[2]  # Red
        else:
            return self.colors[3]  # Dark Red


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        logger.debug(f"Received: {json.dumps(input_data)}")

        # Load segments from segments.json file
        with open("packages/backend/data/segments.json", "r") as f:
            segments_data = json.load(f)
            segments = []
            for feature in segments_data["features"]:
                props = feature["properties"]
                segment = Segment(
                    sid=props["sid"],
                    line_id=props["line"],
                    from_station_id=props["from_station_id"],
                    to_station_id=props["to_station_id"],
                )
                segments.append(segment)
        logger.debug(f"Created {len(segments)} segment objects")

        # Initialize risk predictor
        predictor = RiskPredictor(segments)
        logger.debug("Initialized RiskPredictor")

        reports = []
        latest_timestamp = None

        for inspector in input_data:
            lines = inspector["lines"]
            direction = inspector["direction"]

            # Debug the values we're extracting
            logger.debug(
                f"Processing inspector record - Station: {inspector['station_id']}, Lines: {lines}, Direction: {direction}"
            )

            timestamp = datetime.fromisoformat(
                inspector["timestamp"].replace("Z", "+00:00")
            )

            # Track the latest timestamp
            if latest_timestamp is None or timestamp > latest_timestamp:
                latest_timestamp = timestamp

            reports.append(
                Report(
                    station_id=inspector["station_id"],
                    timestamp=timestamp,
                    direction_id=direction if direction else None,
                    lines=lines,
                )
            )
        logger.debug(f"Created {len(reports)} report objects")

        # Generate predictions
        segment_colors = predictor.predict(reports)
        logger.debug(f"Generated predictions for {len(segment_colors)} segments")

        # Create response in the correct format
        response = {
            "last_modified": (
                latest_timestamp.isoformat() + "Z"
                if latest_timestamp
                else datetime.now(timezone.utc).isoformat() + "Z"
            ),
            "segment_colors": segment_colors,
        }

        # Output filtered results to stdout
        json.dump(response, sys.stdout)
        logger.debug("Successfully wrote results to stdout")

    except Exception as e:
        logger.error(f"Error in risk model: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
