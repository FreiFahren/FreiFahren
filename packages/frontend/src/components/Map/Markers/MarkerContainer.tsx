import React, { useEffect, useState, useRef } from 'react';

import { getRecentDataWithIfModifiedSince } from '../../../utils/dbUtils';
import { OpacityMarker } from './Classes/OpacityMarker/OpacityMarker';
import MarkerModal from '../../Modals/MarkerModal/MarkerModal';
import { CloseButton } from '../../Buttons/CloseButton/CloseButton';
import { useModalAnimation } from '../../../utils/uiUtils';

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

	useEffect(() => {
		const fetchData = async () => {
			const newTicketInspectorList = await getRecentDataWithIfModifiedSince(`${process.env.REACT_APP_API_URL}/recent`, lastReceivedInspectorTimestamp.current) || [];

			if (newTicketInspectorList.length > 0) {
				setTicketInspectorList(currentList => {
					const existingStationIds = new Set(currentList.map(inspector => inspector.station.id));
					const filteredNewInspectors = newTicketInspectorList.filter((inspector: { station: { id: string; }; }) => !existingStationIds.has(inspector.station.id));

					if (filteredNewInspectors.length > 0) {
						lastReceivedInspectorTimestamp.current = newTicketInspectorList[0].timestamp;
						return [...currentList, ...filteredNewInspectors];
					}

					return currentList;
				});
			}
		};

		fetchData();
		const interval = setInterval(fetchData, 5*1000);

		return () => clearInterval(interval);
	}, [formSubmitted]);

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
