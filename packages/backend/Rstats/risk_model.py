import pandas as pd
import geopandas as gpd
import numpy as np
import json
from datetime import datetime
from scipy.special import expit  # Sigmoid function
import os
import pytz

# Define utility functions
def pmin2_na(a, b):
    """Compute the element-wise minimum of two Series, ignoring NaNs."""
    return pd.concat([a, b], axis=1).min(axis=1)

def sigmoid(x, beta=1.0):
    """Sigmoid function with adjustable steepness."""
    return expit(beta * x)

# Define the Risk Classifier class
class FreifahrenRiskClassifier:
    def __init__(self, segments, data, current_time, score_col="score", projection_col="color"):
        self.segments = segments.copy()
        self.data = data.copy()
        self.current_time = current_time
        self.score_col = score_col
        self.projection_col = projection_col

        self.pre_process()
        self.assess_risk()
        self.project_risk()

    def pre_process(self):
        # Required columns in segments
        required_columns = ['line', 'stop_to', 'stop_from', 'r', 'sid']
        missing_columns = [col for col in required_columns if col not in self.segments.columns]
        
        if missing_columns:
            print(f"Missing columns in segments: {missing_columns}")
            # Assign default values or handle as needed
            for col in missing_columns:
                if col in ['stop_to', 'stop_from']:
                    self.segments[col] = np.nan  # Or some meaningful default
                elif col == 'r':
                    self.segments[col] = 1  # Default ranking/risk value
            print("Assigned default values to missing columns.")

        # Normalize string columns to prevent mismatches
        string_columns_data = ['line', 'station_id', 'direction_id']
        string_columns_segments = ['line', 'stop_to', 'stop_from']
        
        for col in string_columns_data:
            if col in self.data.columns:
                self.data[col] = self.data[col].astype(str).str.strip().str.upper()
        
        for col in string_columns_segments:
            if col in self.segments.columns:
                self.segments[col] = self.segments[col].astype(str).str.strip().str.upper()

        # Sort segments within each line based on 'r' to establish order
        self.segments = self.segments.sort_values(['line', 'r']).reset_index(drop=True)
        
        # Assign an order index within each line for easy distance calculation
        self.segments['order'] = self.segments.groupby('line').cumcount()

        # Debug: Print segments after sorting and ordering
        print("\nSegments after sorting and assigning order:")
        print(self.segments[['line', 'sid', 'stop_from', 'stop_to', 'r', 'order']].head())

        # Determine direction based on 'station_id' and 'direction_id'
        # Each direction_id is a station on the given line
        # Compare 'r' of direction_id station with 'r' of station_id to determine direction
        # Forward (1) if direction_id's r > station_id's r
        # Backward (-1) if direction_id's r < station_id's r
        # Unknown (0) if direction_id not found on the line

        # Merge to get 'r' for 'station_id'
        station_r = self.segments[['line', 'stop_from', 'r']].copy()
        station_r = station_r.rename(columns={'stop_from': 'station_id', 'r': 'station_r'})
        station_r = station_r[['line', 'station_id', 'station_r']]
        station_r.drop_duplicates(inplace=True)

        # Merge to get 'r' for 'direction_id' by matching both 'stop_from' and 'stop_to'
        direction_r_from = self.segments[['line', 'stop_from', 'r']].copy()
        direction_r_from = direction_r_from.rename(columns={'stop_from': 'direction_id', 'r': 'direction_r'})
        direction_r_to = self.segments[['line', 'stop_to', 'r']].copy()
        direction_r_to = direction_r_to.rename(columns={'stop_to': 'direction_id', 'r': 'direction_r'})
        direction_r = pd.concat([direction_r_from, direction_r_to]).drop_duplicates()

        # Merge station_r with data on 'line' and 'station_id'
        self.data = self.data.merge(
            station_r,
            how='left',
            on=['line', 'station_id']
        )

        # Merge direction_r with data on 'line' and 'direction_id'
        self.data = self.data.merge(
            direction_r,
            how='left',
            on=['line', 'direction_id']
        )

        # Debug: Print data after merging 'station_r' and 'direction_r'
        print("\nData after merging 'station_r' and 'direction_r':")
        print(self.data.head())

        # Determine direction based on 'station_r' and 'direction_r'
        self.data['direction'] = self.data.apply(self.determine_direction, axis=1)

        # Debug: Print data after determining direction
        print("\nData after determining direction:")
        print(self.data[['line', 'station_id', 'direction_id', 'station_r', 'direction_r', 'direction']].head())

        # Merge data with segments to find the reported segment based on 'station_id'
        # The reported segment is the one where 'stop_from' == 'station_id'
        reported_segments = self.segments[['line', 'stop_from', 'sid', 'order']].copy()
        reported_segments = reported_segments.rename(columns={'stop_from': 'station_id', 'sid': 'reported_sid', 'order': 'reported_order'})

        # Merge reported_sid and reported_order based on 'line' and 'station_id'
        self.data = self.data.merge(
            reported_segments,
            how='left',
            on=['line', 'station_id']
        )

        # Debug: Print data after merging reported segments
        print("\nData after merging reported segments:")
        print(self.data[['line', 'station_id', 'reported_sid', 'reported_order']].head())

        # Check for missing reported segments
        missing_reported = self.data['reported_sid'].isna()
        if missing_reported.any():
            print(f"\nWarning: {missing_reported.sum()} reports have unmatched 'station_id'. These reports will be dropped.")
            self.data = self.data[~missing_reported]

        # Final debug: Print the processed data
        print("\nFinal processed data:")
        print(self.data[['line', 'station_id', 'direction_id', 'station_r', 'direction_r', 'direction', 'reported_sid', 'reported_order']])

    def determine_direction(self, row):
        """Determine direction based on station_r and direction_r."""
        if pd.isna(row['station_r']) or pd.isna(row['direction_r']):
            return 0  # Unknown
        elif row['direction_r'] > row['station_r']:
            return 1  # Forward
        elif row['direction_r'] < row['station_r']:
            return -1  # Backward
        else:
            return 0  # Unknown if equal

    def assess_risk(self):
        risk_records = []

        # Parameters for sigmoid function
        beta_forward = 0.5  # Adjusted for slower decay in correct direction
        beta_backward = 1.25  # 2.5x beta_forward for faster decay in wrong direction

        # Iterate over each ticket
        for idx, ticket in self.data.iterrows():
            line = ticket['line']
            reported_order = ticket['reported_order']
            direction = ticket['direction']  # 1 for forward, -1 for backward, 0 for unknown

            print(f"\nProcessing report {idx+1}: Line={line}, Station={ticket['station_id']}, Direction={direction}")

            # Filter segments in the same line
            line_segments = self.segments[self.segments['line'] == line].copy()

            # Calculate distance in segments (number of segments between reported segment and current segment)
            line_segments['segment_distance'] = np.abs(line_segments['order'] - reported_order)

            # Determine directionality per segment
            if direction == 1:
                # Correct direction: towards 'stop_to'
                line_segments['is_correct_direction'] = 1
                beta = beta_forward
                print("Direction: Forward")
            elif direction == -1:
                # Opposite direction: towards 'stop_from'
                line_segments['is_correct_direction'] = -1
                beta = beta_backward
                print("Direction: Backward")
            else:
                # Unknown direction
                line_segments['is_correct_direction'] = 0
                beta = 1.0  # Default beta
                print("Direction: Unknown")

            # Assign risk based on sigmoid function
            if direction != 0:
                line_segments['risk'] = sigmoid(-line_segments['segment_distance'] * beta)
                print(f"Applied sigmoid with beta={beta}")
            else:
                # Assign minimal risk for unknown direction
                line_segments['risk'] = 0.1
                print("Assigned minimal risk for unknown direction")

            # Ensure the reported segment has the highest risk
            line_segments.loc[line_segments['segment_distance'] == 0, 'risk'] = 1.0
            print("Assigned highest risk to the reported segment")

            # Debug: Print a summary of risks for this report
            print("Risk distribution for this report:")
            print(line_segments[['sid', 'segment_distance', 'risk']].head())

            # Append to risk records
            for _, seg in line_segments.iterrows():
                risk_records.append({
                    'sid': seg['sid'],
                    'risk': seg['risk']
                })

        # Create DataFrame from risk records
        risk_df = pd.DataFrame(risk_records)

        # Debug: Print aggregated risk before normalization
        print("\nAggregated risk before normalization:")
        print(risk_df.groupby('sid')['risk'].sum().reset_index().head())

        # Aggregate risk by segment (sum risks from multiple tickets)
        aggregated_risk = risk_df.groupby('sid')['risk'].sum().reset_index()

        # Normalize risk to be between 0 and 1
        max_risk = aggregated_risk['risk'].max()
        if max_risk > 0:
            aggregated_risk['risk'] = aggregated_risk['risk'] / max_risk
        else:
            aggregated_risk['risk'] = 0

        # Debug: Print aggregated risk after normalization
        print("\nAggregated risk after normalization:")
        print(aggregated_risk.head())

        # Merge aggregated risk back to segments
        self.segments = self.segments.merge(
            aggregated_risk,
            on='sid',
            how='left'
        ).fillna({'risk': 0})

        # Assign to score_col
        self.segments[self.score_col] = self.segments['risk']

    def project_risk(self):
        # Map score to color
        conditions = [
            (self.segments[self.score_col] >= 0) & (self.segments[self.score_col] < 0.2),
            (self.segments[self.score_col] >= 0.2) & (self.segments[self.score_col] < 0.5),
            (self.segments[self.score_col] >= 0.5) & (self.segments[self.score_col] < 0.9),
            (self.segments[self.score_col] >= 0.9) & (self.segments[self.score_col] <= 1)
        ]
        choices = ["#13C184", "#FACB3F", "#F05044", "#A92725"]
        self.segments[self.projection_col] = np.select(conditions, choices, default="grey")

        # Debug: Print color assignments
        print("\nColor assignments based on risk scores:")
        print(self.segments[['sid', 'risk', self.projection_col]].head())

    def get_segments(self):
        return self.segments

def classify_risk(segments, data, current_time):
    classifier = FreifahrenRiskClassifier(segments, data, current_time)
    return classifier.get_segments()

def main():
    # Load ticket data
    try:
        ticket_info = pd.read_csv("ticket_data.csv")
        print("ticket_info contents:")
        print(ticket_info.head())
    except FileNotFoundError:
        print("Error: 'ticket_data.csv' not found.")
        raise

    # Check if the required columns exist
    expected_columns = ['Timestamp', 'StationId', 'Lines', 'DirectionId']
    missing_columns = [col for col in expected_columns if col not in ticket_info.columns]
    if missing_columns:
        raise KeyError(f"Missing columns in ticket_data.csv: {missing_columns}")

    # Process ticket_info
    ticket_info['Lines'] = ticket_info['Lines'].str.split('|')
    ticket_info.rename(columns={
        'Timestamp': 'timestamp',
        'StationId': 'station_id',
        'Lines': 'line',
        'DirectionId': 'direction_id'
    }, inplace=True)

    # Explode lines
    ticket_info = ticket_info.explode('line')
    ticket_info['line'] = ticket_info['line'].replace({'S42': 'S41'})
    ticket_info['line'] = ticket_info['line'].str.strip().str.upper()
    ticket_info['multi'] = ticket_info.groupby('timestamp')['line'].transform('count') > 1
    ticket_info['ring'] = ticket_info['line'] == 'S41'

    # Convert timestamp to datetime
    ticket_info['timestamp'] = pd.to_datetime(ticket_info['timestamp'], utc=True)

    # Load segments data
    try:
        segments = gpd.read_file("Rstats/segments/segments_v5.geojson")
        print("\nGeoJSON Columns:", segments.columns.tolist())
    except Exception as e:
        print(f"Error loading segments_v5.geojson: {e}")
        raise e

    # Verify required columns in segments
    required_segments_columns = ['line', 'stop_to', 'stop_from', 'r', 'sid', 'line_color', 'geometry']
    print(f"\nLines in segments: {segments['line'].unique()}")
    missing_segments_columns = [col for col in required_segments_columns if col not in segments.columns]
    if missing_segments_columns:
        raise KeyError(f"Missing columns in segments_v5.geojson: {missing_segments_columns}")

    # Ensure 'r' is numeric
    segments['r'] = pd.to_numeric(segments['r'], errors='coerce')

    # Current time
    now = datetime.now(pytz.utc)
    suffix = now.strftime("%Y-%m-%dT%H.%M.%S")

    # Check if ticket_info is empty
    if ticket_info.empty:
        output_path = f"./output/risk_model_{suffix}.json"
        os.makedirs(os.path.dirname(output_path), exist_ok=True)
        with open(output_path, 'w') as f:
            json.dump([], f)
        raise Exception("No reports to analyse")

    # Prepare data for classification
    exc = ticket_info[['timestamp', 'line', 'station_id', 'direction_id', 'multi', 'ring']].copy()

    # Classify risk
    try:
        risk_model = classify_risk(segments, exc, now)
    except Exception as e:
        print(f"Error during risk classification: {e}")
        raise e

    # Check if 'score' column exists
    if 'score' not in risk_model.columns:
        print("Warning: 'score' column not found in risk_model. Ensure that assess_risk method correctly computes it.")
        # Assign default score or handle accordingly
        risk_model['score'] = 0  # Default score

    # Filter and select required fields
    required_fields = {'sid', 'line', 'color'}
    if required_fields.issubset(risk_model.columns):
        risk_model_filtered = risk_model[risk_model['score'] > 0.2][['sid', 'line', 'color']]
    else:
        missing_fields = required_fields - set(risk_model.columns)
        raise KeyError(f"Missing fields in risk_model: {missing_fields}")

    # Convert to JSON
    risk_model_json = risk_model_filtered.to_dict(orient='records')
    print(f"\nrisk_model_json: {risk_model_json}")

    # Write to JSON file
    output_path = f"./output/risk_model_{suffix}.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(risk_model_json, f, indent=4)

    print(f"Risk model written to {output_path}")

if __name__ == "__main__":
    main()
