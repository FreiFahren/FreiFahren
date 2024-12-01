from typing import Dict, List, Tuple, Optional
import json
import math
import networkx as nx
from datetime import datetime, timedelta, timezone
import numpy as np
import pandas as pd
from dataclasses import dataclass
import os
import logging
import sys
import geopandas as gpd

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
            "#13C184",  # Green (default/no risk)
            "#FACB3F",  # Yellow (low risk)
            "#F05044",  # Red (medium risk)
            "#A92725",  # Dark Red (high risk)
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
        if (
            segment.from_station_id not in self.graph
            or segment.to_station_id not in self.graph
        ):
            logger.debug(
                f"Warning: Segment stations not found in graph: {segment.from_station_id} -> {segment.to_station_id}"
            )
            return 0.0

        # Find all segments that share the same stations (overlapping segments)
        overlapping_segments = []
        for s in self.segments:
            if (
                s.from_station_id == segment.from_station_id
                and s.to_station_id == segment.to_station_id
            ) or (
                s.from_station_id == segment.to_station_id
                and s.to_station_id == segment.from_station_id
            ):
                overlapping_segments.append(s)

        for report in reports:
            # Skip if report station is not in graph
            if report.station_id not in self.graph:
                logger.debug(
                    f"Warning: Report station not found in graph: {report.station_id}"
                )
                continue

            # Skip old reports
            age = current_time - report.timestamp
            if age > self.max_report_age:
                continue

            # Skip if this segment's line is not in the report's lines
            if segment.line_id not in report.lines:
                continue

            # Compute temporal risk
            temporal_risk = self._compute_temporal_risk(age.total_seconds() / 3600)

            # Adjust risk based on number of possible lines
            line_risk_factor = 1.0 / len(report.lines)
            temporal_risk *= line_risk_factor

            try:
                # Create a subgraph containing only edges of the current line and overlapping lines
                relevant_lines = {segment.line_id} | {
                    s.line_id for s in overlapping_segments
                }
                line_subgraph = nx.DiGraph()
                for u, v, data in self.graph.edges(data=True):
                    if data["line_id"] in relevant_lines:
                        line_subgraph.add_edge(u, v)
                        # Also add reverse edge for undirected calculation
                        line_subgraph.add_edge(v, u)

                # Add nodes that might be isolated
                line_subgraph.add_node(report.station_id)
                line_subgraph.add_node(segment.from_station_id)
                line_subgraph.add_node(segment.to_station_id)

                # Consider direction if provided
                if report.direction_id:
                    try:
                        # If direction is provided, only look for paths in that direction
                        if report.direction_id == "1":  # Forward direction
                            path = nx.shortest_path(
                                line_subgraph,
                                report.station_id,
                                segment.from_station_id,
                            )
                        else:  # Backward direction
                            path = nx.shortest_path(
                                line_subgraph,
                                segment.from_station_id,
                                report.station_id,
                            )
                        distance = len(path) - 1
                    except nx.NetworkXNoPath:
                        distance = float("inf")
                else:
                    # If no direction, consider both directions
                    forward_distance = float("inf")
                    backward_distance = float("inf")

                    try:
                        forward_distance = nx.shortest_path_length(
                            line_subgraph, report.station_id, segment.from_station_id
                        )
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        pass

                    try:
                        backward_distance = nx.shortest_path_length(
                            line_subgraph, segment.from_station_id, report.station_id
                        )
                    except (nx.NetworkXNoPath, nx.NodeNotFound):
                        pass

                    distance = min(forward_distance, backward_distance)

            except Exception as e:
                logger.debug(
                    f"Warning: Error calculating path for segment {segment.sid}: {str(e)}"
                )
                distance = float("inf")

            # Compute spatial risk
            spatial_risk = self._compute_spatial_risk(distance)

            # Compute base risk
            base_risk = temporal_risk * spatial_risk

            # Add spillover risk from overlapping segments
            if len(overlapping_segments) > 1:  # If there are overlapping segments
                spillover_factor = 0.5  # Reduce the risk for overlapping segments
                base_risk = min(
                    1.0,
                    base_risk
                    * (1 + spillover_factor * (len(overlapping_segments) - 1)),
                )

            # Update total risk (take maximum of all reports)
            total_risk = max(total_risk, base_risk)

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


def main():
    try:
        # Get the directory of the current script
        script_dir = os.path.dirname(os.path.abspath(__file__))
        segments_path = os.path.join(script_dir, "segments.geojson")
        logger.debug(f"Loading segments from: {segments_path}")

        # Read JSON input from stdin
        input_data = json.load(sys.stdin)
        logger.debug(f"Received: {json.dumps(input_data)}")

        # Load segments from GeoJSON using absolute path
        segments_gdf = gpd.read_file(segments_path)
        logger.debug(f"Loaded {len(segments_gdf)} segments from GeoJSON")

        segments = [
            Segment(
                sid=row["sid"],
                line_id=row["line"],
                from_station_id=row["from_station_id"],
                to_station_id=row["to_station_id"],
            )
            for _, row in segments_gdf.iterrows()
        ]
        logger.debug(f"Created {len(segments)} segment objects")

        # Initialize risk predictor
        predictor = RiskPredictor(segments)
        logger.debug("Initialized RiskPredictor")

        # Convert input data to Report objects
        reports = []
        latest_timestamp = None
        for inspector in input_data:
            # Extract values from nested JSON structure
            lines = inspector.get("lines", [])  # Expect lines to be a list
            direction_id = (
                inspector.get("direction_id", {}).get("String", "")
                if isinstance(inspector.get("direction_id"), dict)
                else inspector.get("direction_id", "")
            )

            # Debug the values we're extracting
            logger.debug(
                f"Processing inspector record - Station: {inspector.get('station_id')}, Lines: {lines}, Direction: {direction_id}"
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
                    direction_id=direction_id if direction_id else None,
                    lines=lines,
                )
            )
        logger.debug(f"Created {len(reports)} report objects with data: {reports}")

        # Generate predictions
        segment_colors = predictor.predict(reports)
        logger.debug(f"Generated predictions for {len(segment_colors)} segments")

        # Filter out segments with #00FF00 color
        filtered_colors = {k: v for k, v in segment_colors.items() if v != "#13C184"}
        logger.debug(f"Filtered to {len(filtered_colors)} segments with risk")

        # Create response in the correct format
        response = {
            "last_modified": (
                latest_timestamp.isoformat() + "Z"
                if latest_timestamp
                else datetime.now(timezone.utc).isoformat() + "Z"
            ),
            "segment_colors": filtered_colors,
        }

        # Output filtered results to stdout
        json.dump(response, sys.stdout)
        logger.debug("Successfully wrote results to stdout")

    except Exception as e:
        logger.error(f"Error in risk model: {str(e)}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
