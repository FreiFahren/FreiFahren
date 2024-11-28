import { useState } from 'react'
import { sendAnalyticsEvent } from 'src/utils/analytics'

import { useTicketInspectors } from '../../../contexts/TicketInspectorsContext'
import { useModalAnimation } from '../../../hooks/UseModalAnimation'
import { MarkerData } from '../../../utils/types'
import { CloseButton } from '../../Buttons/CloseButton/CloseButton'
import { MarkerModal } from '../../Modals/MarkerModal/MarkerModal'
import { OpacityMarker } from './Classes/OpacityMarker/OpacityMarker'

export interface MarkersProps {
    formSubmitted: boolean
    isFirstOpen: boolean
    userPosition?: { lng: number; lat: number } | null | null
}

export const MarkerContainer = ({ formSubmitted, isFirstOpen, userPosition }: MarkersProps) => {
    const { ticketInspectorList } = useTicketInspectors()
    const [selectedMarker, setSelectedMarker] = useState<MarkerData | null>(null)

    const {
        isOpen: isMarkerModalOpen,
        isAnimatingOut: isMarkerModalAnimatingOut,
        openModal: openMarkerModal,
        closeModal: closeMarkerModal,
    } = useModalAnimation()

    const handleMarkerClick = (markerData: MarkerData) => {
        setSelectedMarker(markerData)
        const now = new Date()
        const ageInMinutes = Math.floor((now.getTime() - new Date(markerData.timestamp).getTime()) / (60 * 1000))

        sendAnalyticsEvent('Marker clicked', {
            meta: {
                station: markerData.station.name,
                ageInMinutes,
                isHistoric: markerData.isHistoric,
            }
        })
        openMarkerModal()
    }

    return (
        <div>
            {ticketInspectorList.map((ticketInspector, index) => (
                <OpacityMarker
                    isFirstOpen={isFirstOpen}
                    markerData={ticketInspector}
                    index={index}
                    key={ticketInspector.station.id}
                    formSubmitted={formSubmitted}
                    onMarkerClick={handleMarkerClick}
                />
            ))}
            {isMarkerModalOpen && selectedMarker && (
                <MarkerModal
                    selectedMarker={selectedMarker}
                    className={`open ${isMarkerModalAnimatingOut ? 'slide-out' : 'slide-in'}`}
                    userLat={userPosition?.lat}
                    userLng={userPosition?.lng}
                >
                    <CloseButton closeModal={closeMarkerModal} />
                </MarkerModal>
            )}
        </div>
    )
}
