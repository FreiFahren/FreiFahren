import { useTranslation } from 'react-i18next'
import { useStations } from '../../../api/queries'
import { getClosestStations } from '../../../hooks/getClosestStations'
import AutocompleteInputForm from '../../Form/AutocompleteInputForm/AutocompleteInputForm'
import { StationProperty } from 'src/utils/types'
import { useLocation } from '../../../contexts/LocationContext'
import { useState, useRef, useEffect } from 'react'

import './NavigationModal.css'

interface NavigationModalProps {
    className?: string
}

const NavigationModal: React.FC<NavigationModalProps> = ({ className }) => {
    const { t } = useTranslation()

    const { data: allStations } = useStations()

    const [startStation, setStartStation] = useState<StationProperty | null>(null)
    const [endStation, setEndStation] = useState<StationProperty | null>(null)
    const [possibleStartStations, setPossibleStartStations] = useState<Record<string, StationProperty>>(
        allStations ?? {}
    )
    const [possibleEndStations, setPossibleEndStations] = useState<Record<string, StationProperty>>(allStations ?? {})

    const { userPosition } = useLocation()

    useEffect(() => {
        console.log('Start station changed', startStation)
    }, [startStation])

    return (
        <div className={`navigation-modal modal container ${className}`}>
            <h1>{t('NavigationModal.title')}</h1>
            <div className="location-inputs">
                <input type="text" autoFocus placeholder={t('NavigationModal.startLocation')} />
                <input type="text" placeholder={t('NavigationModal.endLocation')} />
            </div>
            <div className="autocomplete-container">
                <AutocompleteInputForm
                    items={possibleStartStations}
                    onSelect={(name: string | null) => {
                        if (name) {
                            const key = Object.keys(possibleStartStations).find(
                                (key) => possibleStartStations[key].name === name
                            )
                            if (key) {
                                setStartStation(possibleStartStations[key])
                                setPossibleStartStations((prev) => ({ ...prev, [key]: prev[key] }))
                                console.log('key', key)
                                console.log('possibleStartStations', possibleStartStations)
                            }
                        }
                    }}
                    value={startStation?.name ?? null}
                    getDisplayValue={(station: StationProperty | null) => station?.name ?? ''}
                    highlightElements={
                        userPosition
                            ? getClosestStations(3, allStations ?? {}, userPosition).reduce(
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
