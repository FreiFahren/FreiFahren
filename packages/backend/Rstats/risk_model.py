import pandas as pd
import geopandas as gpd
import numpy as np
import json
from datetime import datetime, timedelta
from scipy.special import expit  # For inv.logit
from scipy.stats import betabinom
import os
import pytz

# Define utility functions
def pmin2_na(a, b):
    """Compute the element-wise minimum of two Series, ignoring NaNs."""
    return pd.concat([a, b], axis=1).min(axis=1)

def dbbinom_scaled(x, alpha, beta, size, peak=1, shift=0):
    """Scale the beta-binomial PMF."""
    return betabinom.pmf(abs(x) + shift, size, alpha, beta) / betabinom.pmf(peak, size, alpha, beta)

def s_discount(x, t, ttl=500, strn=0.2, shift=0.44):
    """Apply a sigmoid discount based on time lag."""
    strn_adj = strn * ttl
    adjusted_ttl = ttl * (1 + shift)
    discount = 1 / (1 + np.exp((t - adjusted_ttl) / strn_adj))
    return x * discount

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
        required_columns = ['line', 'stop_to', 'stop_from', 'r']
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

        # Define separate line_ranks DataFrames to prevent duplicate columns
        line_ranks_dir1 = self.segments[['line', 'stop_to', 'r']].rename(columns={'r': 'r_dir1'})
        line_ranks_dir2 = self.segments[['line', 'stop_from', 'r']].rename(columns={'r': 'r_dir2'})
        line_ranks_st1 = self.segments[['line', 'stop_to', 'r']].rename(columns={'r': 'r_st1'})
        line_ranks_st2 = self.segments[['line', 'stop_from', 'r']].rename(columns={'r': 'r_st2'})

        # Filter data based on timestamp
        self.data = self.data[self.data['timestamp'] <= self.current_time].copy()
        print(f"Data after timestamp filter: {self.data.shape[0]} rows")

        # Merge with r_dir1
        self.data = self.data.merge(
            line_ranks_dir1,
            how='left',
            left_on=['line', 'direction_id'],
            right_on=['line', 'stop_to']
        ).drop(columns=['stop_to'], errors='ignore')

        print("After merging with r_dir1:", self.data.columns.tolist())
        print("Sample after merging with r_dir1:", self.data[['line', 'direction_id', 'r_dir1']].head())

        # Check for NaNs in r_dir1
        missing_r_dir1 = self.data['r_dir1'].isna().sum()
        if missing_r_dir1 > 0:
            print(f"Warning: {missing_r_dir1} entries have NaN in 'r_dir1' after merging with r_dir1.")

        # Merge with r_dir2
        self.data = self.data.merge(
            line_ranks_dir2,
            how='left',
            left_on=['line', 'direction_id'],
            right_on=['line', 'stop_from']
        ).drop(columns=['stop_from'], errors='ignore')

        print("After merging with r_dir2:", self.data.columns.tolist())
        print("Sample after merging with r_dir2:", self.data[['line', 'direction_id', 'r_dir2']].head())

        # Check for NaNs in r_dir2
        missing_r_dir2 = self.data['r_dir2'].isna().sum()
        if missing_r_dir2 > 0:
            print(f"Warning: {missing_r_dir2} entries have NaN in 'r_dir2' after merging with r_dir2.")

        # Merge with r_st1
        self.data = self.data.merge(
            line_ranks_st1,
            how='left',
            left_on=['line', 'station_id'],
            right_on=['line', 'stop_to']
        ).drop(columns=['stop_to'], errors='ignore')

        print("After merging with r_st1:", self.data.columns.tolist())
        print("Sample after merging with r_st1:", self.data[['line', 'station_id', 'r_st1']].head())

        # Check for NaNs in r_st1
        missing_r_st1 = self.data['r_st1'].isna().sum()
        if missing_r_st1 > 0:
            print(f"Warning: {missing_r_st1} entries have NaN in 'r_st1' after merging with r_st1.")

        # Merge with r_st2
        self.data = self.data.merge(
            line_ranks_st2,
            how='left',
            left_on=['line', 'station_id'],
            right_on=['line', 'stop_from']
        ).drop(columns=['stop_from'], errors='ignore')

        print("After merging with r_st2:", self.data.columns.tolist())
        print("Sample after merging with r_st2:", self.data[['line', 'station_id', 'r_st2']].head())

        # Check for NaNs in r_st2
        missing_r_st2 = self.data['r_st2'].isna().sum()
        if missing_r_st2 > 0:
            print(f"Warning: {missing_r_st2} entries have NaN in 'r_st2' after merging with r_st2.")

        # Compute r_dir and r_st
        self.data['r_dir'] = self.data[['r_dir1', 'r_dir2']].bfill(axis=1).iloc[:, 0]
        self.data['r_st'] = pmin2_na(self.data['r_st1'], self.data['r_st2'])
        self.data['r_st1_'] = self.data[['r_st1', 'r_st2']].bfill(axis=1).iloc[:, 0]
        self.data['r_st2_'] = self.data[['r_st2', 'r_st1']].bfill(axis=1).iloc[:, 0]

        print("Computed 'r_dir' and 'r_st':")
        print("r_dir sample:", self.data['r_dir'].head())
        print("r_st sample:", self.data['r_st'].head())

        # Compute direction
        self.data['dir'] = np.where(
            self.data['station_id'].notna(),
            np.where(
                self.data['r_dir'] <= self.data['r_st'],
                -1,
                1
            ),
            0
        )

        print("Computed 'dir' sample:", self.data['dir'].head())

        # Compute temporal lag in seconds
        self.data['lag'] = (self.current_time - self.data['timestamp']).dt.total_seconds()

        print("Computed 'lag' sample:", self.data['lag'].head())

        # Drop unnecessary columns
        self.data.drop(columns=['r_dir1', 'r_dir2', 'r_st1', 'r_st2'], inplace=True)

        # Debug: Print columns after preprocessing
        print("Columns after pre_process:", self.data.columns.tolist())
        print("Unique lines in data:", self.data['line'].unique())
        print("Unique lines in segments:", self.segments['line'].unique())

    def assess_risk(self):
        # Compute direct_risk, bidirect_risk, line_risk
        self.data = self.data.reset_index(drop=True)
        self.data['id'] = self.data.index + 1  # R is 1-indexed

        # Apply risk functions
        self.data['direct_risk'] = self.data.apply(self.direct_risk, axis=1)
        self.data['bidirect_risk'] = self.data.apply(self.bidirect_risk, axis=1)
        self.data['line_risk'] = self.data.apply(self.line_risk, axis=1)

        # Debug: Print direct_risk values
        print("Direct risk values:", self.data['direct_risk'].tolist())

        # Neighbour segments
        neighbour_segments = self.segments[['line', 'r']].rename(columns={'r': 'r_neigh'})
        n_ring = self.segments[self.segments['line'] == 'S41'].shape[0]

        # Station-based risk
        station_based = self.data.merge(
            self.segments,
            on='line',
            how='left',
            suffixes=('', '_seg')
        )

        # Identify lines in data not present in segments
        lines_in_data = set(self.data['line'].unique())
        lines_in_segments = set(self.segments['line'].unique())
        missing_lines = lines_in_data - lines_in_segments

        if missing_lines:
            print(f"Warning: The following lines from ticket data are missing in segments: {missing_lines}")

        # For demonstration, we'll compute aggregate risk as a simple sum
        score_per_line = self.data.groupby('line')['direct_risk'].sum().clip(upper=1).reset_index()
        print("Score per line:", score_per_line)

        # Merge score_per_line with segments
        self.segments = self.segments.merge(score_per_line, on='line', how='left')
        self.segments[self.score_col] = self.segments['direct_risk'].fillna(0)
        print("Segments with scores:", self.segments[['line', 'score']].head())

        # Debug: Print segments after risk assessment
        print("Segments after assess_risk:", self.segments.head())

    def direct_risk(self, row):
        if pd.isna(row['dir']):
            value = 0
        elif row['dir'] == 0:
            value = 0
        elif row['dir'] == 1 or row['dir'] == -1:
            value = 0.8
        else:
            value = 0
        discounted = s_discount(value, row['lag'], ttl=1000, strn=0.2, shift=0.4)
        return discounted

    def bidirect_risk(self, row):
        if pd.isna(row['dir']):
            value = 0
        elif row['dir'] == 0:
            value = 1
        elif row['dir'] == 1 or row['dir'] == -1:
            value = 0.2
        else:
            value = 0
        discounted = s_discount(value, row['lag'], ttl=2000, strn=0.3, shift=0.4)
        return discounted

    def line_risk(self, row):
        if pd.isna(row['station_id']):
            value = 0.1
        else:
            value = 0.05
        discounted = s_discount(value, row['lag'], ttl=4000, strn=0.3, shift=0.2)
        return discounted

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

        # Debug: Print segments after projecting risk
        print("Segments after project_risk:", self.segments.head())

    def get_segments(self):
        return self.segments

def classify_risk(segments, data, current_time):
    classifier = FreifahrenRiskClassifier(segments, data, current_time)
    return classifier.get_segments()

def main():
    # Load ticket data
    try:
        ticket_info = pd.read_csv("ticket_data.csv")
        print("ticket_info contents:", ticket_info.head())
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
        print("GeoJSON Columns:", segments.columns.tolist())
    except Exception as e:
        print(f"Error loading segments_v5.geojson: {e}")
        raise e

    # Verify required columns in segments
    required_segments_columns = ['line', 'stop_to', 'stop_from', 'r', 'sid', 'line_color', 'geometry']
    print(f"Lines in segments: {segments['line'].unique()}")
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
    print(f"risk_model_json: {risk_model_json}")

    # Write to JSON file
    output_path = f"./output/risk_model_{suffix}.json"
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, 'w') as f:
        json.dump(risk_model_json, f, indent=4)

    print(f"Risk model written to {output_path}")

if __name__ == "__main__":
    main()
