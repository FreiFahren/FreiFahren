export {}; // to make this file a module

declare global {
    interface Window {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        pirsch: (eventName: string, options: { duration: number; meta: Record<string, any> }) => void;
    }
}

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
