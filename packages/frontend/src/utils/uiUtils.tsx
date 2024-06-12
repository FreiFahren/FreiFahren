import { selectOption } from '../components/Form/AutocompleteInputForm/AutocompleteInputForm';
import { useState } from 'react';

type StationsList = {
	[key: string]: {
		name: string;
		lines: string[];
	};
};

type LinesList = {
	[key: string]: string[];
};

export function highlightElement(id: string) {
	const element = document.getElementById(id);

	if (element !== null) {
		if (element) {
			element.classList.add('highlight');
			setTimeout(() => {
				element.classList.remove('highlight');
			}, 3000);
		}
	} else {

		const elementClass = document.getElementsByClassName(id);

		if (elementClass) {
			elementClass[0].classList.add('highlight');
			setTimeout(() => {
				elementClass[0].classList.remove('highlight');
			}, 3000);
		}
	}
}

// when a station is selected, the line options are redefined, giving only the lines that the station is connected to
export const redefineLineOptions = (option: selectOption, stationsList: StationsList): selectOption[] => {
	const newLineOptions = Object.entries(stationsList)
		.filter(([station_id]) => station_id === option.value)
		.flatMap(([, station]) => station.lines.map(line => ({ value: line, label: line })));

	return newLineOptions;
}

// when a line is selected, the station options are redefined, giving only the stations that the line is connected to
export const redefineStationOptions = (option: selectOption, linesList: LinesList, stationsList: StationsList): selectOption[] => {
	const newStationOptions: selectOption[] = [];

	for (const station_id of linesList[option.value]) {
		newStationOptions.push({ value: station_id, label: stationsList[station_id].name });
	}

	return newStationOptions;
}

// when a line is selected, the direction options are redefined, giving only the first and last station of the line
export const redefineDirectionOptions = (option: selectOption, linesList: LinesList, stationsList: StationsList): selectOption[] => {
	const length = linesList[option.value].length;
	const { 0: firstStationId, [length - 1]: lastStationId } = linesList[option.value];
	const newDirectionOptions = [
		{ value: firstStationId, label: stationsList[firstStationId].name },
		{ value: lastStationId, label: stationsList[lastStationId].name },
	];

	return newDirectionOptions;
}

export function createWarningSpan(elementId: string, message: string) {
	let warningSpan = document.getElementById('warning-span');
	if (!warningSpan) {
		warningSpan = document.createElement('span');
		warningSpan.id = 'warning-span';
		warningSpan.className = 'red-highlight';
		warningSpan.textContent = message;
		document.getElementById(elementId)?.appendChild(warningSpan);
	}
}

export function useModalAnimation(timeout = 250) {
	const [isOpen, setIsOpen] = useState(false);
	const [isAnimatingOut, setIsAnimatingOut] = useState(false);

	const openModal = () => setIsOpen(true);

	const closeModal = () => {
		setIsAnimatingOut(true);
		setTimeout(() => {
			setIsOpen(false);
			setIsAnimatingOut(false);
		}, timeout);
	};

	return { isOpen, isAnimatingOut, openModal, closeModal };
}

export const currentColorTheme = () => {
	const colorTheme = localStorage.getItem('colorTheme');
	return colorTheme ? colorTheme : 'dark';
}

export function setColorThemeInLocalStorage() {
	const colorTheme = currentColorTheme();

	if (colorTheme === 'dark') {
		localStorage.setItem('colorTheme', 'light');
	} else {
		localStorage.setItem('colorTheme', 'dark');
	}
}

export const handleTextareaInput = (event: React.ChangeEvent<HTMLTextAreaElement>) => {
	const target = event.target as HTMLTextAreaElement;
	target.style.height = 'auto';
	const maxHeight = window.innerHeight * 0.35; // Set it based on the screen height

	if (target.scrollHeight > maxHeight) {
		target.style.height = `${maxHeight}px`;
		target.style.overflowY = 'auto';
	} else {
		target.style.height = `${target.scrollHeight}px`;
	}
};
