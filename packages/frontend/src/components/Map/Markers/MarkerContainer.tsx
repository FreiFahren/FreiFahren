import React, { useState } from 'react'
import { useCurrentReports } from 'src/api/queries'
import { sendAnalyticsEvent } from 'src/hooks/useAnalytics'

import { useModalAnimation } from '../../../hooks/UseModalAnimation'
import { Report } from '../../../utils/types'
import CloseButton from '../../Buttons/CloseButton/CloseButton'
import { MarkerModal } from '../../Modals/MarkerModal/MarkerModal'
import { OpacityMarker } from './Classes/OpacityMarker/OpacityMarker'

export interface MarkersProps {
    isFirstOpen: boolean
    userPosition?: { lng: number; lat: number } | null | null
}

const MarkerContainer: React.FC<MarkersProps> = ({ isFirstOpen, userPosition }) => {
    const { data: currentReports } = useCurrentReports()
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
            {currentReports?.map((ticketInspector, index) => (
                <OpacityMarker
                    isFirstOpen={isFirstOpen}
                    markerData={ticketInspector}
                    index={index}
                    key={ticketInspector.station.id}
                    onMarkerClick={handleMarkerClick}
                />
            ))}
            {isMarkerModalOpen
                ? selectedMarker && (
                      <MarkerModal
                          selectedMarker={selectedMarker}
                          className={`open ${isMarkerModalAnimatingOut ? 'slide-out' : 'slide-in'}`}
                          userLat={userPosition?.lat}
                          userLng={userPosition?.lng}
                      >
                          <CloseButton handleClose={closeMarkerModal} />
                      </MarkerModal>
                  )
                : null}
        </div>
    )
}

export { MarkerContainer }
