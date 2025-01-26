from typing import Dict, List, Optional, Tuple
from datetime import datetime, timezone
import json
import sys
from pathlib import Path
from dataclasses import dataclass
import math
import numpy as np
from scipy.stats import betabinom


@dataclass
class Report:
    station_id: str
    timestamp: datetime
    direction_id: Optional[str]
    lines: List[str]
    is_multi: bool = False
    is_ring: bool = False


@dataclass
class Segment:
    sid: str
    line_id: str
    from_station_id: str
    to_station_id: str
    rank: int = 0  # Position in the line sequence


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

        # Calculate ranks for segments within each line
        self._calculate_segment_ranks()

    def _calculate_segment_ranks(self):
        """Calculate the position (rank) of each segment within its line."""
        line_segments = {}
        for segment in self.segments:
            if segment.line_id not in line_segments:
                line_segments[segment.line_id] = []
            line_segments[segment.line_id].append(segment)

        for line_id, segments in line_segments.items():
            for i, segment in enumerate(segments):
                segment.rank = i

    def _calculate_temporal_decay(
        self,
        time_diff_seconds: float,
        ttl: float = 1000,
        strength: float = 0.2,
        shift: float = 0.4,
    ) -> float:
        """
        Calculate temporal decay factor using a logistic function.

        Args:
            time_diff_seconds: Time difference in seconds between now and the report
            ttl: Time-to-live in seconds
            strength: Controls the steepness of the decay curve
            shift: Shifts the midpoint of the decay curve

        Returns:
            Decay factor between 0 and 1
        """
        strength_adj = strength * ttl
        adjusted_ttl = ttl * (1 + shift)
        return 1 / (1 + math.exp((time_diff_seconds - adjusted_ttl) / strength_adj))

    def _calculate_direct_risk(self, report: Report, time_diff: float) -> float:
        """Calculate direct risk based on direction and temporal decay."""
        if report.direction_id is None:
            return 0.0

        base_risk = 0.8  # High base risk for directed reports
        return base_risk * self._calculate_temporal_decay(
            time_diff, ttl=1000, strength=0.2, shift=0.4
        )

    def _calculate_bidirect_risk(self, report: Report, time_diff: float) -> float:
        """Calculate bidirectional risk based on direction and temporal decay."""
        if report.direction_id is None:
            base_risk = 1.0  # Highest risk when direction is unknown
        else:
            base_risk = 0.2  # Lower risk when direction is known

        # Apply multi-line penalty
        if report.is_multi:
            base_risk *= 0.2

        return base_risk * self._calculate_temporal_decay(
            time_diff, ttl=2000, strength=0.3, shift=0.4
        )

    def _calculate_line_risk(self, report: Report, time_diff: float) -> float:
        """Calculate line-wide risk based on report type and temporal decay."""
        base_risk = 0.1 if report.station_id is None else 0.05
        return base_risk * self._calculate_temporal_decay(
            time_diff, ttl=4000, strength=0.3, shift=0.2
        )

    def _dbbinom_scaled(
        self,
        x: np.ndarray,
        alpha: float,
        beta: float,
        size: int,
        peak: int = 1,
        shift: int = 0,
    ) -> np.ndarray:
        """
        Calculate scaled beta-binomial distribution for spatial decay.

        Args:
            x: Array of distances
            alpha: Alpha parameter of beta distribution
            beta: Beta parameter of beta distribution
            size: Size parameter of binomial distribution
            peak: Position of maximum probability
            shift: Shift in the distribution

        Returns:
            Array of probabilities
        """
        x = np.abs(x) + shift
        peak_prob = betabinom.pmf(peak, size, alpha, beta)
        probs = betabinom.pmf(x, size, alpha, beta)
        return probs / peak_prob if peak_prob > 0 else probs

    def _calculate_spatial_decay(self, distance: int, decay_type: str) -> float:
        """
        Calculate spatial decay based on distance and type.

        Args:
            distance: Distance between segments
            decay_type: Type of decay ('direct', 'bidirect', or 'line')

        Returns:
            Decay factor between 0 and 1
        """
        if decay_type == "direct":
            return float(
                self._dbbinom_scaled(
                    np.array([distance]), alpha=1.456, beta=2.547, size=6, peak=1
                )[0]
            )
        elif decay_type == "bidirect":
            return float(
                self._dbbinom_scaled(
                    np.array([distance]),
                    alpha=1.336,
                    beta=1.968,
                    size=5,
                    peak=1,
                    shift=1,
                )[0]
            )
        else:  # line
            return float(
                self._dbbinom_scaled(
                    np.array([distance]),
                    alpha=0.9891,
                    beta=1.175,
                    size=30,
                    peak=0,
                    shift=0,
                )[0]
            )

    def predict(self, reports: List[Report]) -> Dict[str, str]:
        """
        Predict risk levels for transport segments based on inspector reports.

        The prediction process works as follows:
        1. For each report, calculates three types of risk:
           - Direct risk: Highest for reports with known direction
           - Bidirectional risk: Highest when direction is unknown
           - Line-wide risk: Base risk applied to entire lines

        2. Risk propagation:
           - For station-based reports: Risk decays spatially based on segment distance
           - For line-wide reports: Risk is distributed across all segments of the line
           - Multiple reports' risks are combined additively (capped at 1.0)
           - Risk is propagated to overlapping segments

        3. Risk to color conversion:
           - ≤ 0.2: Green (no risk)
           - ≤ 0.5: Yellow (low risk)
           - ≤ 0.9: Red (medium risk)
           - > 0.9: Dark Red (high risk)

        Args:
            reports: List of Report objects containing inspector observations

        Returns:
            Dictionary mapping segment IDs to color codes representing risk levels.
            Only segments with risk (non-green) are included in the output.
        """
        # Get current time for temporal decay calculation
        current_time = datetime.now(timezone.utc)

        # Initialize risk components for all segments
        segment_risks = {
            segment.sid: {"direct": 0.0, "bidirect": 0.0, "line": 0.0}
            for segment in self.segments
        }

        # Process each report
        for report in reports:
            time_diff = (current_time - report.timestamp).total_seconds()

            # Calculate base risks for this report
            direct_risk = self._calculate_direct_risk(report, time_diff)
            bidirect_risk = self._calculate_bidirect_risk(report, time_diff)
            line_risk = self._calculate_line_risk(report, time_diff)

            # Find affected segments and propagate risks
            for segment in self.segments:
                if segment.line_id in report.lines:
                    # Calculate distance from report location
                    if report.station_id:
                        # For station-based reports
                        station_rank = next(
                            (
                                s.rank
                                for s in self.segments
                                if s.line_id == segment.line_id
                                and (
                                    s.from_station_id == report.station_id
                                    or s.to_station_id == report.station_id
                                )
                            ),
                            None,
                        )
                        if station_rank is not None:
                            distance = abs(segment.rank - station_rank)

                            # Apply spatial decay to each risk component
                            direct_decay = self._calculate_spatial_decay(
                                distance, "direct"
                            )
                            bidirect_decay = self._calculate_spatial_decay(
                                distance, "bidirect"
                            )
                            line_decay = self._calculate_spatial_decay(distance, "line")

                            # Update segment risks
                            current_risks = segment_risks[segment.sid]
                            current_risks["direct"] = min(
                                1.0,
                                current_risks["direct"] + direct_risk * direct_decay,
                            )
                            current_risks["bidirect"] = min(
                                1.0,
                                current_risks["bidirect"]
                                + bidirect_risk * bidirect_decay,
                            )
                            current_risks["line"] = min(
                                1.0, current_risks["line"] + line_risk * line_decay
                            )
                    else:
                        # For line-wide reports
                        segment_risks[segment.sid]["line"] = min(
                            1.0, segment_risks[segment.sid]["line"] + line_risk
                        )

        # Calculate final risk scores
        final_risks = {}
        for sid, risks in segment_risks.items():
            # Combine risk components
            total_risk = min(1.0, risks["direct"] + risks["bidirect"] + risks["line"])
            final_risks[sid] = total_risk

        # Convert risks to colors
        segment_colors = {}
        for sid, risk in final_risks.items():
            color = self._risk_to_color(risk)
            if color != self.colors[0]:  # Only include segments with risk
                segment_colors[sid] = color

        # Create a dictionary to store segments by their start and end stations
        segments_by_stations: Dict[Tuple[str, str], List[Segment]] = {}
        for segment in self.segments:
            # order station IDs alphabetically to handle bidirectional segments
            stations = tuple(sorted((segment.from_station_id, segment.to_station_id)))
            if stations not in segments_by_stations:
                segments_by_stations[stations] = []
            segments_by_stations[stations].append(segment)

        # Propagate risk colors to overlapping segments
        for sid, color in list(
            segment_colors.items()
        ):  # Iterate over a copy to avoid modifying the dictionary while iterating
            # Find the segment corresponding to the current sid
            current_segment = next((s for s in self.segments if s.sid == sid), None)
            if current_segment:
                # Get station pair for current segment
                stations = tuple(
                    sorted(
                        (current_segment.from_station_id, current_segment.to_station_id)
                    )
                )
                # overlapping segment inherits risk color
                overlapping_segments = segments_by_stations.get(stations, [])
                for overlapping_segment in overlapping_segments:
                    segment_colors[overlapping_segment.sid] = color

        return segment_colors

    def _risk_to_color(self, risk: float) -> str:
        """Convert risk score to color code using thresholds from R model."""
        if risk <= 0.2:
            return self.colors[0]  # Green
        elif risk <= 0.5:
            return self.colors[1]  # Yellow
        elif risk <= 0.9:
            return self.colors[2]  # Red
        else:
            return self.colors[3]  # Dark Red


def main():
    try:
        # Read JSON input from stdin
        input_data = json.load(sys.stdin)

        # Load segments from segments.json file
        segments_path = Path("data/segments.json")
        with segments_path.open("r") as f:
            segments_data = json.load(f)
            segments = []
            for feature in segments_data["features"]:
                props = feature["properties"]
                # Parse sid to extract station IDs segment format: LINE.FROM_STATION:TO_STATION
                line_and_stations = props["sid"].split(".")
                station_ids = line_and_stations[1].split(":")
                segment = Segment(
                    sid=props["sid"],
                    line_id=line_and_stations[0],
                    from_station_id=station_ids[0],
                    to_station_id=station_ids[1],
                )
                segments.append(segment)

        # Initialize risk predictor
        predictor = RiskPredictor(segments)

        reports = []
        latest_timestamp = None

        for inspector in input_data:
            lines = inspector["lines"]
            direction = inspector["direction"]

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

        # Generate predictions
        segment_colors = predictor.predict(reports)

        # Create response in the correct format
        response = {
            "segment_colors": segment_colors,
        }

        # Output filtered results to stdout
        json.dump(response, sys.stdout)

    except Exception as e:
        raise


if __name__ == "__main__":
    main()
