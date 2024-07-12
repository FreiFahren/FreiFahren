import React, { useEffect, useState, useMemo, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import { Marker } from 'react-map-gl/maplibre';

import { MarkerData } from '../../MarkerContainer';

import './OpacityMarker.css';

interface OpacityMarkerProps {
    markerData: MarkerData;
    index: number;
    isFirstOpen: boolean;
    formSubmitted: boolean;
    onMarkerClick: (markerData: MarkerData) => void;
}

export const OpacityMarker: React.FC<OpacityMarkerProps> = ({ markerData, index, isFirstOpen, formSubmitted, onMarkerClick }) => {
    const [opacity, setOpacity] = useState(0);
    const { timestamp, station, line, isHistoric } = markerData;

    // By using useMemo, we can avoid recalculating the timestamp on every render
    const adjustedTimestamp = useMemo(() => {
        const tempTimestamp = new Date(timestamp);
        return new Date(tempTimestamp);
    }, [timestamp]);

    const markerRef = useRef<maplibregl.Marker>(null);

    const [isWithin30Mins, setIsWithin30Mins] = useState(false);

    useEffect(() => {
        let intervalId: NodeJS.Timeout;
        if (!isFirstOpen) {
            if (!isHistoric) {
                const calculateOpacity = () => {
                    const currentTime = new Date().getTime();
                    const elapsedTime = currentTime - adjustedTimestamp.getTime();
                    const timeToFade = 60 * 60 * 1000;
                    let newOpacity = Math.max(0, 1 - (elapsedTime / timeToFade));

                    // When the opacity is too low the marker is not visible
                    if (newOpacity <= 0.20) {
                        newOpacity = 0.20;
                    }
                    setOpacity(newOpacity);

                    // indicate that the marker should not pulse anymore
                    setIsWithin30Mins(elapsedTime <= 30 * 60 * 1000);

                    if (elapsedTime >= timeToFade) {
                        setOpacity(0);
                        clearInterval(intervalId);
                    }
                };
                // change the direct reference of the marker
                markerRef.current?.setOpacity(opacity.toString());

                calculateOpacity(); // Initial calculation
                intervalId = setInterval(calculateOpacity, 30 * 1000); // Avoid excessive calculations
            } else {
                markerRef.current?.setOpacity('0.5');
                setOpacity(0.5);
            }
            return () => clearInterval(intervalId);
        }
    }, [adjustedTimestamp, isHistoric, isFirstOpen, opacity, station.name, formSubmitted]);

    if (opacity <= 0) {
        return null;
    }

    return (
        <Marker
            key={`${line}-${index}`}
            ref={markerRef}
            className='inspector-marker'
            latitude={station.coordinates.latitude}
            longitude={station.coordinates.longitude}
            style={{ opacity: opacity.toString()}}
            onClick={()=> onMarkerClick(markerData)}
        >
            <span className={`live ${isWithin30Mins ? 'pulse' : ''}`} />
        </Marker>
    );
};
