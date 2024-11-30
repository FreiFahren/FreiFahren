from typing import Dict, List, Tuple, Optional
import json
import math
import networkx as nx
from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
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
        max_age_hours = self.max_report_age.total_seconds() / 3600
        if age_hours >= max_age_hours:
            return 0.0

        # Sigmoid function for smooth decay
        x = age_hours / max_age_hours
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

        # First, verify that the segment stations exist in the graph
        if segment.from_station_id not in self.graph or segment.to_station_id not in self.graph:
            print(f"Warning: Segment stations not found in graph: {segment.from_station_id} -> {segment.to_station_id}")
            return 0.0

        for report in reports:
            # Skip if report is not for the same line
            if report.line_id != segment.line_id:
                continue

            # Skip if report station is not in graph
            if report.station_id not in self.graph:
                print(f"Warning: Report station not found in graph: {report.station_id}")
                continue

            # Skip old reports
            age = current_time - report.timestamp
            if age > self.max_report_age:
                continue

            # Compute temporal risk
            temporal_risk = self._compute_temporal_risk(age.total_seconds() / 3600)

            # Find shortest path distance only within the same line
            try:
                # Create a subgraph containing only edges of the current line
                line_subgraph = nx.DiGraph()
                for u, v, data in self.graph.edges(data=True):
                    if data['line_id'] == segment.line_id:
                        line_subgraph.add_edge(u, v)
                        # Also add reverse edge for undirected calculation
                        line_subgraph.add_edge(v, u)

                # Add nodes that might be isolated
                line_subgraph.add_node(report.station_id)
                line_subgraph.add_node(segment.from_station_id)
                line_subgraph.add_node(segment.to_station_id)

                # Consider direction if provided
                if report.direction:
                    try:
                        # If direction is provided, only look for paths in that direction
                        if report.direction == "1":  # Forward direction
                            path = nx.shortest_path(line_subgraph, report.station_id, segment.from_station_id)
                        else:  # Backward direction
                            path = nx.shortest_path(line_subgraph, segment.from_station_id, report.station_id)
                        distance = len(path) - 1
                    except nx.NetworkXNoPath:
                        distance = float('inf')
                else:
                    # If no direction, consider both directions
                    forward_distance = float('inf')
                    backward_distance = float('inf')
                    
                    try:
                        forward_distance = nx.shortest_path_length(line_subgraph, report.station_id, segment.from_station_id)
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        pass
                        
                    try:
                        backward_distance = nx.shortest_path_length(line_subgraph, segment.from_station_id, report.station_id)
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        pass
                        
                    distance = min(forward_distance, backward_distance)

            except Exception as e:
                print(f"Warning: Error calculating path for segment {segment.sid}: {str(e)}")
                distance = float('inf')

            # Compute spatial risk
            spatial_risk = self._compute_spatial_risk(distance)

            # Combine risks
            risk = temporal_risk * spatial_risk

            # Update total risk (take maximum of all reports)
            total_risk = max(total_risk, risk)

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
            current_time = datetime.now(timezone.utc)

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
    # remove all of the colors with 00FF00
    colors = {k: v for k, v in colors.items() if v != "#00FF00"}

    """Save segment colors to JSON file."""
    with open(output_file, "w") as f:
        json.dump(colors, f, indent=2)


def main():
    # Load segments from GeoJSON (assuming segments.geojson exists)
    import geopandas as gpd

    segments_gdf = gpd.read_file("segments.geojson")
    
    print("Debug: Loading segments and reports...")
    print(f"Number of segments loaded: {len(segments_gdf)}")
    
    segments = [
        Segment(
            sid=row["sid"],
            line_id=row["line"],
            from_station_id=row["from_station_id"],
            to_station_id=row["to_station_id"],
        )
        for _, row in segments_gdf.iterrows()
    ]

    # Print some debug info about the first few segments
    print("\nFirst few segments:")
    for segment in segments[:3]:
        print(f"Segment {segment.sid}: {segment.from_station_id} -> {segment.to_station_id} (Line: {segment.line_id})")

    # Initialize risk predictor
    predictor = RiskPredictor(segments)

    # Load reports from CSV instead of JSON
    reports = load_reports("ticket_data.csv")

    # Generate predictions
    segment_colors = predictor.predict(reports)

    # Save results
    save_segment_colors(segment_colors, "output/segment_colors.json")


if __name__ == "__main__":
    main()
