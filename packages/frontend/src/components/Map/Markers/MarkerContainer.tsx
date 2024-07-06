import React, { useEffect, useState, useRef } from 'react';

import { getRecentDataWithIfModifiedSince } from '../../../utils/dbUtils';
import { OpacityMarker } from './Classes/OpacityMarker/OpacityMarker';
import MarkerModal from '../../Modals/MarkerModal/MarkerModal';
import { CloseButton } from '../../Buttons/CloseButton/CloseButton';
import { useModalAnimation } from '../../../utils/uiUtils';
import { useRiskData } from '../../../contexts/RiskDataContext';

export interface MarkersProps {
	formSubmitted: boolean;
	isFirstOpen: boolean;
	userPosition?: { lng: number, lat: number } | null | null;
}

export type MarkerData = {
	timestamp: string;
	station: {
		id: string;
		name: string;
		coordinates: {
			latitude: number;
			longitude: number;
		};
	};
	direction: {
		id: string;
		name: string;
		coordinates: {
			latitude: number;
			longitude: number;
		};
	};
	line: string;
	isHistoric: boolean;
	message?: string;
};

const MarkerContainer: React.FC<MarkersProps> = ({ formSubmitted, isFirstOpen, userPosition }) => {
	const [ticketInspectorList, setTicketInspectorList] = useState<MarkerData[]>([]);
	const lastReceivedInspectorTimestamp = useRef<string | null>(null);
	const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null);
	const riskData = useRiskData();

	useEffect(() => {
		const fetchData = async () => {
			const newTicketInspectorList = await getRecentDataWithIfModifiedSince(`${process.env.REACT_APP_API_URL}/basics/recent`, lastReceivedInspectorTimestamp.current) || [];

			if (newTicketInspectorList.length > 0) {
				setTicketInspectorList(currentList => {
					// Create a map to track the most recent entry per station ID
					const updatedList = new Map(currentList.map(inspector => [inspector.station.id, inspector]));

					newTicketInspectorList.forEach((newInspector: MarkerData) => {
						const existingInspector = updatedList.get(newInspector.station.id);
						if (existingInspector) {
							// Compare timestamps and wether it is historic to decide if we need to update
							if (new Date(newInspector.timestamp) > new Date(existingInspector.timestamp) && newInspector.isHistoric === false) {
								updatedList.set(newInspector.station.id, newInspector);
							}
						} else {
							// If no existing inspector with the same ID, add the new one
							updatedList.set(newInspector.station.id, newInspector);
						}
					});

					// Set the latest timestamp from the fetched data
					lastReceivedInspectorTimestamp.current = newTicketInspectorList[0].timestamp;
					riskData.refreshRiskData();

					// Convert the map back to an array for the state
					return Array.from(updatedList.values());
				});
			}
		};

		fetchData();
		const interval = setInterval(fetchData, 5*1000);

		return () => clearInterval(interval);
	}, [formSubmitted, riskData]);

	const {
		isOpen: isMarkerModalOpen,
		isAnimatingOut: isMarkerModalAnimatingOut,
		openModal: openMarkerModal,
		closeModal: closeMarkerModal
	} = useModalAnimation();

	const handleMarkerClick = (markerData: MarkerData) => {
		setSelectedMarker(markerData);
		openMarkerModal();
	};

	return (
		<div >
			{ticketInspectorList.map((ticketInspector, index) => {
					return (
						<OpacityMarker
							isFirstOpen={isFirstOpen}
							markerData={ticketInspector}
							index={index}
							key={ticketInspector.station.id}
							formSubmitted={formSubmitted}
							onMarkerClick={handleMarkerClick}
						/>
					);

			})}
			{isMarkerModalOpen && selectedMarker &&
			<>
				<MarkerModal
					selectedMarker={selectedMarker}
					className={`open ${isMarkerModalAnimatingOut ? 'slide-out' : 'slide-in'}`}
					userLat={userPosition?.lat}
					userLng={userPosition?.lng}
				>
					<CloseButton closeModal={closeMarkerModal}/>
				</MarkerModal>
			</>
			}
		</div>
	);
};

export default MarkerContainer;
