import React, { useState } from 'react'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'

import { useTicketInspectors } from '../../../contexts/TicketInspectorsContext'
import { useModalAnimation } from '../../../hooks/UseModalAnimation'
import { Report } from '../../../utils/types'
import { CloseButton } from '../../Buttons/CloseButton/CloseButton'
import { MarkerModal } from '../../Modals/MarkerModal/MarkerModal'
import { OpacityMarker } from './Classes/OpacityMarker/OpacityMarker'

export interface MarkersProps {
    formSubmitted: boolean
    isFirstOpen: boolean
    userPosition?: { lng: number; lat: number } | null | null
}

const MarkerContainer: React.FC<MarkersProps> = ({ formSubmitted, isFirstOpen, userPosition }) => {
    const { ticketInspectorList } = useTicketInspectors()
    const [selectedMarker, setSelectedMarker] = useState<Report | null>(null)

    const {
        isOpen: isMarkerModalOpen,
        isAnimatingOut: isMarkerModalAnimatingOut,
        openModal: openMarkerModal,
        closeModal: closeMarkerModal,
    } = useModalAnimation()

    const handleMarkerClick = (report: Report) => {
        setSelectedMarker(report)
        const now = new Date()
        const ageInMinutes = Math.floor((now.getTime() - new Date(report.timestamp).getTime()) / (60 * 1000))

        sendAnalyticsEvent('Marker clicked', {
            meta: {
                station: report.station.name,
                ageInMinutes,
                isHistoric: report.isHistoric,
            },
        }).catch((error) => {
            // fix later with sentry
            // eslint-disable-next-line no-console
            console.error('Error sending analytics event:', error)
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
            {isMarkerModalOpen ? selectedMarker && (
                <MarkerModal
                    selectedMarker={selectedMarker}
                    className={`open ${isMarkerModalAnimatingOut ? 'slide-out' : 'slide-in'}`}
                    userLat={userPosition?.lat}
                    userLng={userPosition?.lng}
                >
                    <CloseButton handleClose={closeMarkerModal} />
                    </MarkerModal>
                ) : null}
        </div>
    )
}

export { MarkerContainer }
