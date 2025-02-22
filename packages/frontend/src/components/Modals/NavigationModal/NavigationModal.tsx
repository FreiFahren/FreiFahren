import { useTranslation } from 'react-i18next'
import { useStations } from '../../../api/queries'
import { getClosestStations } from '../../../hooks/getClosestStations'
import AutocompleteInputForm from '../../Form/AutocompleteInputForm/AutocompleteInputForm'
import { StationProperty } from 'src/utils/types'
import { useLocation } from '../../../contexts/LocationContext'
import { useState } from 'react'

import './NavigationModal.css'

interface NavigationModalProps {
    className?: string
}

type ActiveInput = 'start' | 'end' | null

const NavigationModal: React.FC<NavigationModalProps> = ({ className }) => {
    const { t } = useTranslation()
    const { userPosition } = useLocation()
    const { data: allStations } = useStations()

    const [searchValue, setSearchValue] = useState('')
    const [activeInput, setActiveInput] = useState<ActiveInput>(null)
    const [startLocation, setStartLocation] = useState<string | null>(null)
    const [endLocation, setEndLocation] = useState<string | null>(null)

    const possibleStations = allStations
        ? Object.fromEntries(
              Object.entries(allStations).filter(([_, station]) =>
                  station.name.toLowerCase().includes(searchValue.toLowerCase())
              )
          )
        : {}

    const handleStationSelect = (stationName: string | null) => {
        if (!stationName || !allStations) return

        const selectedStation = Object.entries(allStations).find(([_, station]) => station.name === stationName)
        if (!selectedStation) return

        if (activeInput === 'start') {
            setStartLocation(selectedStation[0])
        } else if (activeInput === 'end') {
            setEndLocation(selectedStation[0])
        }

        setSearchValue('')
    }

    const getInputValue = (input: ActiveInput) => {
        if (input === 'start' && startLocation && allStations) {
            return allStations[startLocation].name
        }
        if (input === 'end' && endLocation && allStations) {
            return allStations[endLocation].name
        }
        return activeInput === input ? searchValue : ''
    }

    return (
        <div className={`navigation-modal modal container ${className}`}>
            <h1>{t('NavigationModal.title')}</h1>
            <div className="location-inputs">
                <input
                    type="text"
                    placeholder={t('NavigationModal.startLocation')}
                    value={getInputValue('start')}
                    autoFocus
                    onFocus={() => setActiveInput('start')}
                    onChange={(e) => {
                        setSearchValue(e.target.value)
                        setStartLocation(null)
                    }}
                />
                <input
                    type="text"
                    placeholder={t('NavigationModal.endLocation')}
                    value={getInputValue('end')}
                    onFocus={() => setActiveInput('end')}
                    onChange={(e) => {
                        setSearchValue(e.target.value)
                        setEndLocation(null)
                    }}
                />
            </div>
            <div className="autocomplete-container">
                <AutocompleteInputForm
                    items={possibleStations}
                    onSelect={handleStationSelect}
                    value={activeInput === 'start' ? startLocation : endLocation}
                    getDisplayValue={(station: StationProperty | null) => station?.name ?? ''}
                    highlightElements={
                        userPosition && activeInput === 'start'
                            ? getClosestStations(3, possibleStations, userPosition).reduce(
                                  (acc, station) => ({ ...acc, ...station }),
                                  {}
                              )
                            : undefined
                    }
                />
            </div>
        </div>
    )
}

export default NavigationModal
