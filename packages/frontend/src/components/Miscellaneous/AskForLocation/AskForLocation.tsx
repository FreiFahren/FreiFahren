import { useState, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

import './AskForLocation.css'
import AutocompleteInputForm from '../../Form/AutocompleteInputForm/AutocompleteInputForm'
import { useLocation } from '../../../contexts/LocationContext'
import { useStationsAndLines } from '../../../contexts/StationsAndLinesContext'
interface AskForLocationProps {
    className: string
    children?: React.ReactNode
    closeModal: () => void
}

const AskForLocation: React.FC<AskForLocationProps> = ({ className, children, closeModal }) => {
    const { t } = useTranslation()

    const { setUserPosition } = useLocation()
    const { allStations } = useStationsAndLines()
    const [stationsToShow, setStationsToShow] = useState(allStations)

    const [selectedStation, setSelectedStation] = useState<string | null>(null)

    const handleSelect = useCallback(
        (key: string | null) => {
            const foundStationEntry = Object.entries(allStations).find(([, stationData]) => stationData.name === key)
            setSelectedStation(foundStationEntry ? foundStationEntry[0] : null)

            // set the stations to show be the selected value, but when the new selected value is the same as the old one, show all stations
            if (foundStationEntry && foundStationEntry[0] !== selectedStation) {
                setStationsToShow({ [foundStationEntry[0]]: foundStationEntry[1] })
            } else {
                setStationsToShow(allStations)
            }
        },
        [allStations, selectedStation]
    )

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault()
        if (selectedStation && allStations[selectedStation]) {
            const station = allStations[selectedStation]
            setUserPosition({
                lat: station.coordinates.latitude,
                lng: station.coordinates.longitude,
            })
            closeModal()
        }
    }

    return (
        <div className={`ask-for-location info-popup modal ${className}`}>
            {children}
            <form onSubmit={handleSubmit}>
                <h1>{t('AskForLocation.title')}</h1>
                <AutocompleteInputForm
                    items={stationsToShow}
                    onSelect={handleSelect}
                    value={selectedStation}
                    getDisplayValue={(station) => station.name}
                    placeholder={t('AskForLocation.searchPlaceholder')}
                    label={t('AskForLocation.label')}
                    required={false}
                />

                <button type="submit" className={selectedStation ? '' : 'button-gray'} disabled={!selectedStation}>
                    {t('AskForLocation.setLocation')}
                </button>
            </form>
        </div>
    )
}

export default AskForLocation
