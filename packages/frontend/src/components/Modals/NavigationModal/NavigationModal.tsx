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

    const possibleStations = allStations
        ? Object.fromEntries(
              Object.entries(allStations).filter(([_, station]) =>
                  station.name.toLowerCase().includes(searchValue.toLowerCase())
              )
          )
        : {}

    return (
        <div className={`navigation-modal modal container ${className}`}>
            <h1>{t('NavigationModal.title')}</h1>
            <div className="location-inputs">
                <input
                    type="text"
                    placeholder={t('NavigationModal.startLocation')}
                    value={activeInput === 'start' ? searchValue : ''}
                    autoFocus
                    onFocus={() => setActiveInput('start')}
                    onChange={(e) => setSearchValue(e.target.value)}
                />
                <input
                    type="text"
                    placeholder={t('NavigationModal.endLocation')}
                    value={activeInput === 'end' ? searchValue : ''}
                    onFocus={() => setActiveInput('end')}
                    onChange={(e) => setSearchValue(e.target.value)}
                />
            </div>
            <div className="autocomplete-container">
                <AutocompleteInputForm
                    items={possibleStations}
                    onSelect={() => {}}
                    value={null}
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
