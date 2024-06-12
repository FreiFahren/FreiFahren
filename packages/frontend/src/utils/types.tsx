export interface StationGeoJSON {
    type: string;
    features: {
        type: string;
        properties: {
            name: string;
            lines: string[];
        };
        geometry: {
            type: string;
            coordinates: number[];
        };
    }[];
}

export interface RiskData {
    last_modified: string;
    segment_colors: SegmentColors;
}

export interface SegmentColors {
    [key: string]: string;
}
