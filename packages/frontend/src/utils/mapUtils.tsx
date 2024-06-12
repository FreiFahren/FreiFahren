import { StationProperty } from './dbUtils';

export function calculateDistance(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number
) {
	const R = 6371; // Radius of the earth in km
	const dLat = deg2rad(lat2 - lat1);
	const dLon = deg2rad(lon2 - lon1);
	const a =
		Math.sin(dLat / 2) * Math.sin(dLat / 2) +
		Math.cos(deg2rad(lat1)) *
		Math.cos(deg2rad(lat2)) *
		Math.sin(dLon / 2) *
		Math.sin(dLon / 2);
	const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
	const distance = R * c; // Distance in km
	return distance;
}

function deg2rad(deg: number) {
	return deg * (Math.PI / 180);
}

/**
 * Subscribes to user's geolocation changes and executes callback functions based on the result.
 * @param {Function} onPositionChanged Callback that handles position data.
 * @param {Function} openAskForLocation Callback that handles failures in obtaining geolocation.
 * @param {Object} options Configuration options for geolocation.
 * @returns {Function} Unsubscribe function to stop watching position.
 */
export const watchPosition = async (
    onPositionChanged: (position: { lng: number; lat: number } | null) => void,
    openAskForLocation: () => void,
    options: object = {
        enableHighAccuracy: true,
        timeout: 15*1000,
        maximumAge: 15*1000
    }
): Promise<() => void> => {
    const watchId = navigator.geolocation.watchPosition(
        (position) => {
            onPositionChanged({
                lng: position.coords.longitude,
                lat: position.coords.latitude,
            });
        },
        (error) => {
            console.error('Error obtaining position:', error.message);
            onPositionChanged(null);
            openAskForLocation();
        },
        options
    );
    return () => navigator.geolocation.clearWatch(watchId);
};

export const stationDistanceMessage = (stationDistance: number | null): JSX.Element | null => {
    if (!stationDistance || stationDistance === null || stationDistance < 1) return null;
    return (
        <div>
            {stationDistance > 1 ?
                <strong>{stationDistance} Stationen </strong> :
                <strong>eine Station </strong>}
            von dir entfernt
        </div>
    );
};

export const elapsedTimeMessage = (elapsedTime: number, isHistoric: boolean): JSX.Element => {
    if (elapsedTime > 45 * 60 * 1000 || isHistoric) {
        return <span>Vor mehr als <strong>45 Minuten</strong> gemeldet.</span>;
    } else {
        const minutes = Math.max(1, Math.floor(elapsedTime / (60 * 1000)));
        return <span>{formatElapsedTime(minutes)}</span>;
    }
};

const formatElapsedTime = (minutes: number): JSX.Element => {
	const minuteWord = minutes === 1 ? 'Minute' : 'Minuten';
	const minuteCount = minutes === 1 ? 'einer' : minutes;
	return <span>Vor <strong>{minuteCount} {minuteWord}</strong> gemeldet.</span>;
};

export function convertStationsToGeoJSON(stationsData: { [key: string]: StationProperty }) {
    return {
        type: 'FeatureCollection',
        features: Object.keys(stationsData).map(key => ({
            type: 'Feature',
            properties: {
                name: stationsData[key].name,
                lines: stationsData[key].lines
            },
            geometry: {
                type: 'Point',
                coordinates: [
                    stationsData[key].coordinates.longitude,
                    stationsData[key].coordinates.latitude
                ]
            }
        }))
    };
}
