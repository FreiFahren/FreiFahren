/* eslint-disable @typescript-eslint/no-explicit-any */

export {}; // to make this file a module

declare global {
    interface Window {
        pirsch: (eventName: string, options: { duration?: number; meta?: Record<string, any> }) => void;
    }
}

export interface AnalyticsMeta {
    [key: string]: any;
}

export interface AnalyticsOptions {
    duration?: number;
    meta?: AnalyticsMeta;
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
