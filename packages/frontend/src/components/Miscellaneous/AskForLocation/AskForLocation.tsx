import { useState, useEffect } from 'react';

import './AskForLocation.css';
import AutocompleteInputForm, { selectOption } from '../../Form/AutocompleteInputForm/AutocompleteInputForm';
import StationsList from '../../../data/StationsList.json'

interface AskForLocationProps {
    className: string;
    setUserPosition: (coordinates: { lat: number; lng: number }) => void;
    children?: React.ReactNode;
    closeModal: () => void;
}

interface Option {
    value: string;
    label: string;
}

const AskForLocation: React.FC<AskForLocationProps> = ({ className, setUserPosition, children, closeModal }) => {
    const emptyOption = '' as unknown as selectOption;

    const [isValid, setIsValid] = useState(false)
    const [stationInput, setStationInput] = useState(emptyOption)
    const [stationOptions, setStationOptions] = useState<Option[]>([]);

    useEffect(() => {
        function populateStationOptions() {
            const options = Object.keys(StationsList).map(key => ({
                value: key,
                label: StationsList[key as keyof typeof StationsList].name
            }));
            setStationOptions(options);
        }

        populateStationOptions();
    }, []);

    const handleStationChange = (option: selectOption, action: { action: string }) => {
        if (action.action === 'clear') {
            setStationInput(emptyOption);
            setIsValid(false);
            return;
        }
        setStationInput(option);
        setIsValid(true);
    };

    const handleSubmit = (event: React.FormEvent) => {
        event.preventDefault();
        if (stationInput.value) {
            const station = StationsList[stationInput.value as keyof typeof StationsList];
            if (station) {
                setUserPosition({ lat: station.coordinates.latitude, lng: station.coordinates.longitude });
                closeModal();
            } else {
                console.error('Station data not found.');
            }
        } else {
            console.error('No station selected or selection is invalid.');
        }
    };

  return (
    <div className={`ask-for-location info-popup modal ${className}`}>
        {children}
        <form onSubmit={handleSubmit}>
            <h1>Was ist deine nächste Station?</h1>
            <p>Wir konnten deinen Standort nicht finden</p>
            <AutocompleteInputForm
                className='select-field station'
                classNamePrefix='station-select-component'
                options={stationOptions}
                placeholder='Station'
                value={stationInput}
                defaultInputValue={stationInput}
                onChange={(value, action) => handleStationChange(value as selectOption, action)}
            />
            <button type='submit' className={isValid ? '' : 'button-gray'}>Standort setzen</button>
        </form>
    </div>
  );
};

export default AskForLocation;