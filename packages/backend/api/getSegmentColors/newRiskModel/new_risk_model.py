from typing import Dict, List, Tuple, Optional
import json
import math
import networkx as nx
from datetime import datetime, timedelta
import numpy as np
from dataclasses import dataclass


@dataclass
class Report:
    station_id: str
    timestamp: datetime
    direction: Optional[str]
    line_id: str


@dataclass
class Segment:
    sid: str
    line_id: str
    from_station_id: str
    to_station_id: str


class RiskPredictor:
    def __init__(
        self,
        segments: List[Segment],
        max_report_age_hours: float = 24.0,
        risk_levels: int = 4,
        spatial_decay: float = 0.5,
        temporal_decay: float = 0.7,
    ):
        """
        Initialize the risk prediction model.

        Args:
            segments: List of transport line segments
            max_report_age_hours: Maximum age of reports to consider
            risk_levels: Number of discrete risk levels (for color coding)
            spatial_decay: Rate at which risk decreases with distance
            temporal_decay: Rate at which risk decreases with time
        """
        self.segments = segments
        self.max_report_age = timedelta(hours=max_report_age_hours)
        self.risk_levels = risk_levels
        self.spatial_decay = spatial_decay
        self.temporal_decay = temporal_decay

        # Build the network graph
        self.graph = self._build_network_graph()

        # Color scale from green to red
        self.colors = [
            "#00FF00",  # Green
            "#FFFF00",  # Yellow
            "#FFA500",  # Orange
            "#FF0000",  # Red
        ]

    def _build_network_graph(self) -> nx.DiGraph:
        """Build a directed graph representing the transport network."""
        G = nx.DiGraph()

        # Add segments as edges
        for segment in self.segments:
            G.add_edge(
                segment.from_station_id,
                segment.to_station_id,
                sid=segment.sid,
                line_id=segment.line_id,
            )
            # Add reverse direction
            G.add_edge(
                segment.to_station_id,
                segment.from_station_id,
                sid=f"{segment.sid}-rev",
                line_id=segment.line_id,
            )

        return G

    def _compute_temporal_risk(self, age_hours: float) -> float:
        """
        Compute risk based on report age using sigmoid function.

        Args:
            age_hours: Age of the report in hours

        Returns:
            Risk factor between 0 and 1
        """
        if age_hours >= self.max_report_age.total_hours():
            return 0.0

        # Sigmoid function for smooth decay
        x = age_hours / self.max_report_age.total_hours()
        return 1 / (1 + math.exp((x - 0.5) / self.temporal_decay))

    def _compute_spatial_risk(self, distance: int) -> float:
        """
        Compute risk based on distance from report using beta distribution.

        Args:
            distance: Number of segments away from report

        Returns:
            Risk factor between 0 and 1
        """
        return math.exp(-distance * self.spatial_decay)

    def _compute_segment_risk(
        self, segment: Segment, reports: List[Report], current_time: datetime
    ) -> float:
        """
        Compute total risk for a segment based on all reports.

        Args:
            segment: Transport line segment
            reports: List of inspection reports
            current_time: Current timestamp

        Returns:
            Risk score between 0 and 1
        """
        total_risk = 0.0

        for report in reports:
            # Skip old reports
            age = current_time - report.timestamp
            if age > self.max_report_age:
                continue

            # Compute temporal risk
            temporal_risk = self._compute_temporal_risk(age.total_seconds() / 3600)

            # Find shortest path distance
            try:
                distance = nx.shortest_path_length(
                    self.graph, report.station_id, segment.from_station_id
                )
            except nx.NetworkXNoPath:
                distance = float("inf")

            # Compute spatial risk
            spatial_risk = self._compute_spatial_risk(distance)

            # Combine risks
            risk = temporal_risk * spatial_risk

            # Add line-specific risk boost if on same line
            if report.line_id == segment.line_id:
                risk *= 1.5

            total_risk = max(total_risk, risk)  # Take maximum risk from all reports

        return min(total_risk, 1.0)  # Cap at 1.0

    def _risk_to_color(self, risk: float) -> str:
        """Convert risk score to color code."""
        if risk <= 0:
            return self.colors[0]
        elif risk >= 1:
            return self.colors[-1]

        # Map risk to discrete levels
        level = int(risk * (self.risk_levels - 1))
        return self.colors[level]

    def predict(
        self, reports: List[Report], current_time: Optional[datetime] = None
    ) -> Dict[str, str]:
        """
        Generate risk predictions for all segments.

        Args:
            reports: List of inspection reports
            current_time: Current timestamp (defaults to now)

        Returns:
            Dictionary mapping segment IDs to color codes
        """
        if current_time is None:
            current_time = datetime.now()

        segment_colors = {}

        for segment in self.segments:
            risk = self._compute_segment_risk(segment, reports, current_time)
            color = self._risk_to_color(risk)
            segment_colors[segment.sid] = color

        return segment_colors


def load_reports(csv_file: str) -> List[Report]:
    """
    Load inspection reports from CSV file.

    Args:
        csv_file: Path to the CSV file containing ticket inspection reports

    Returns:
        List of Report objects
    """
    reports = []
    df = pd.read_csv(csv_file)

    for _, row in df.iterrows():
        # Parse the timestamp from ISO format
        timestamp = datetime.fromisoformat(row["Timestamp"].replace("Z", "+00:00"))

        # Handle multiple lines if they're comma-separated
        lines = (
            row["Lines"].split(",") if isinstance(row["Lines"], str) else [row["Lines"]]
        )

        # Create a report for each line
        for line_id in lines:
            reports.append(
                Report(
                    station_id=row["StationId"],
                    timestamp=timestamp,
                    direction=(
                        row["DirectionId"] if pd.notna(row["DirectionId"]) else None
                    ),
                    line_id=line_id.strip(),
                )
            )

    return reports


def save_segment_colors(colors: Dict[str, str], output_file: str):
    """Save segment colors to JSON file."""
    with open(output_file, "w") as f:
        json.dump(colors, f, indent=2)


def main():
    # Load segments from GeoJSON (assuming segments.geojson exists)
    import geopandas as gpd

    segments_gdf = gpd.read_file("segments.geojson")

    segments = [
        Segment(
            sid=row["sid"],
            line_id=row["line"],
            from_station_id=row["from_station_id"],
            to_station_id=row["to_station_id"],
        )
        for _, row in segments_gdf.iterrows()
    ]

    # Initialize risk predictor
    predictor = RiskPredictor(segments)

    # Load reports from CSV instead of JSON
    reports = load_reports("ticket_data.csv")

    # Generate predictions
    segment_colors = predictor.predict(reports)

    # Save results
    save_segment_colors(segment_colors, "segment_colors.json")


if __name__ == "__main__":
    main()
