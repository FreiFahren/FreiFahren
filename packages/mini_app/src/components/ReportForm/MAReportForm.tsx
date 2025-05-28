import React, { FC, FormEvent, useCallback, useRef, useState } from 'react';
import './MAReportForm.css';
import { useStations, useLines, useSubmitReport } from '../../api/queries';
import { Report } from '../../utils/types';
import { getLineColor } from '../../utils/getLineColor';
import { ReportSummaryModal } from '../ReportSummaryModal/ReportSummaryModal';

interface Station {
    id: string;
    name: string;
    coordinates?: {
        latitude: number;
        longitude: number;
    }
}

interface ReportFormProps {
}

// Simple SelectField component inspired by the original
const SelectField: FC<{
    children: React.ReactNode;
    containerClassName?: string;
    fieldClassName?: string;
    onSelect: (selectedValue: string | null) => void;
    value: string | null;
    getValue: (child: React.ReactElement) => string;
}> = ({ children, containerClassName, fieldClassName, onSelect, value, getValue }) => {
    const handleSelect = useCallback(
        (child: React.ReactNode) => {
            if (React.isValidElement(child)) {
                const selectedValue = getValue(child);
                const newValue = value === selectedValue ? null : selectedValue; // Toggle selection
                onSelect(newValue);
            }
        },
        [onSelect, value, getValue]
    );

    return (
        <div className={`select-field-container ${containerClassName || ''}`}>
            {React.Children.map(
                children,
                (child, index) =>
                    React.isValidElement(child) && (
                        <div
                            key={index}
                            className={`select-field ${value === getValue(child) ? 'selected' : ''} ${fieldClassName || ''}`}
                            onClick={() => handleSelect(child)}
                        >
                            {child}
                        </div>
                    )
            )}
        </div>
    );
};

// Line component for display
const Line: FC<{ line: string }> = ({ line }) => {
    return (
        <div className="line" style={{ backgroundColor: getLineColor(line) }}>
            {line}
        </div>
    );
};

const ReportForm: FC<ReportFormProps> = () => {
    const { data: stations, isLoading: isLoadingStations } = useStations();
    const { data: lines, isLoading: isLoadingLines } = useLines();
    
    const [currentEntity, setCurrentEntity] = useState<string | null>(null);
    const [currentLine, setCurrentLine] = useState<string | null>(null);
    const [currentStation, setCurrentStation] = useState<string | null>(null);
    const [currentDirection, setCurrentDirection] = useState<string | null>(null);
    const [stationSearch, setStationSearch] = useState<string>('');
    const [description, setDescription] = useState<string>('');
    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false);
    
    // State for the summary modal
    const [showSummary, setShowSummary] = useState<boolean>(false);
    const [reportedData, setReportedData] = useState<Report | null>(null);
    const [numberOfUsers] = useState<number>(Math.floor(Math.random() * 500) + 100); // Mock data for now
    
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const topElementsRef = useRef<HTMLDivElement>(null);
    const bottomElementsRef = useRef<HTMLDivElement>(null);

    const submitReport = useSubmitReport();

    // Calculate possible lines based on entity selection
    const possibleLines = React.useMemo(() => {
        let filteredLines: [string, string[]][] = [];

        if (currentEntity === null) {
            filteredLines = lines ?? [];
        } else {
            filteredLines = (lines ?? []).filter(([line]) => {
                if (currentEntity === 'M') {
                    return line.startsWith('M') || /^\d/.test(line);
                }
                return line.startsWith(currentEntity);
            });
        }

        if (currentStation !== null && stations) {
            const stationData = stations[currentStation];
            if (stationData) {
                filteredLines = filteredLines.filter(([line]) => stationData.lines.includes(line));
            }
        }

        return filteredLines;
    }, [lines, currentEntity, currentStation, stations]);

    // Calculate possible stations based on entity and line selections
    const possibleStations = React.useMemo(() => {
        if (!stations) return {};

        let filteredStations = { ...stations };

        if (currentStation !== null) {
            // If a specific station is selected, just use that one
            filteredStations = stations[currentStation] ? { [currentStation]: stations[currentStation] } : {};
        } else if (currentLine !== null) {
            // If a line is selected, filter stations belonging to that line
            const stationsForLine = lines?.find(([key]) => key === currentLine)?.[1] ?? [];
            filteredStations = Object.fromEntries(
                stationsForLine
                    .map((stationKey) => [stationKey, stations[stationKey]])
                    .filter(([, stationData]) => stationData !== undefined)
            );
        } else if (currentEntity !== null) {
            // If only entity is selected, filter stations by matching lines
            filteredStations = Object.fromEntries(
                Object.entries(stations).filter(([, stationData]) => 
                    stationData.lines.some(line => {
                        if (currentEntity === 'M') {
                            return line.startsWith('M') || /^\d/.test(line);
                        }
                        return line.startsWith(currentEntity);
                    })
                )
            );
        }

        // Apply station search filter if provided
        if (stationSearch.trim()) {
            filteredStations = Object.fromEntries(
                Object.entries(filteredStations).filter(
                    ([, stationData]) => 
                        stationData.name.toLowerCase().includes(stationSearch.toLowerCase())
                )
            );
        }

        return filteredStations;
    }, [stations, currentEntity, currentLine, currentStation, stationSearch, lines]);

    // Get directions based on the line's first and last stations
    const getDirections = useCallback((): Station[] => {
        if (!currentLine || !currentStation || !stations || !lines) return [];
        
        // Ring lines S41/S42 don't have directions
        if (currentLine === 'S41' || currentLine === 'S42') return [];
        
        // Find the line's stations
        const lineStations = lines.find(([line]) => line === currentLine)?.[1] || [];
        
        if (lineStations.length < 2) return [];
        
        // Get the first and last stations of the line
        const firstStationId = lineStations[0];
        const lastStationId = lineStations[lineStations.length - 1];
        
        const firstStation = stations[firstStationId];
        const lastStation = stations[lastStationId];
        
        if (!firstStation || !lastStation) return [];
        
        return [
            { 
                id: firstStationId, 
                name: firstStation.name,
                coordinates: firstStation.coordinates
            },
            { 
                id: lastStationId, 
                name: lastStation.name,
                coordinates: lastStation.coordinates
            }
        ];
    }, [currentLine, currentStation, stations, lines]);

    const possibleDirections = getDirections();

    const handleEntitySelect = useCallback((entity: string | null) => {
        setCurrentEntity(entity);
        
        // Only reset subsequent selections if the current line is no longer valid
        if (currentLine !== null && entity !== null && !currentLine.startsWith(entity)) {
            setCurrentLine(null);
            setCurrentStation(null);
            setCurrentDirection(null);
        }
        // if a station is selected check if the station is still valid for the selected entity
        else if (currentStation !== null && entity !== null && stations) {
            const stationData = stations[currentStation];
            if (stationData) {
                const isValidStation = stationData.lines.some((line) => 
                    entity === 'M' 
                        ? (line.startsWith('M') || /^\d/.test(line))
                        : line.startsWith(entity)
                );
                
                if (!isValidStation) {
                    setCurrentStation(null);
                    setCurrentDirection(null);
                }
            }
        }
    }, [currentLine, currentStation, stations]);

    const handleLineSelect = useCallback((line: string | null) => {
        setCurrentLine(line);
        
        // Find the stations for the selected line
        const stationsForSelectedLine = lines?.find(([key]) => key === line)?.[1] ?? [];
        
        // Reset station if the current station isn't on this line
        if (
            typeof line === 'string' &&
            currentStation !== null &&
            !stationsForSelectedLine.includes(currentStation)
        ) {
            setCurrentStation(null);
            setCurrentDirection(null);
        }
    }, [lines, currentStation]);

    const handleStationSelect = useCallback((stationKey: string | null) => {
        setCurrentStation(stationKey);
        setCurrentDirection(null);  // Reset direction when station changes
    }, []);

    const handleDirectionSelect = useCallback((direction: string | null) => {
        setCurrentDirection(direction);
    }, []);

    const isFormValid = useCallback(() => {
        // Basic validation: we need at least a station
        if (!currentStation) return false;
        
        // Privacy must be checked
        if (!isPrivacyChecked) return false;
        
        return true;
    }, [currentLine, currentStation, currentDirection, possibleDirections, isPrivacyChecked]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        
        if (!isFormValid() || !stations || !currentStation) return;
        
        const stationData = stations[currentStation];
        
        try {
            const report: Report = {
                timestamp: new Date().toISOString(),
                line: currentLine,
                station: {
                    id: currentStation,
                    name: stationData.name,
                    coordinates: stationData.coordinates
                },
                direction: currentDirection ? {
                    id: currentDirection,
                    name: possibleDirections.find(d => d.id === currentDirection)?.name || '',
                    coordinates: {
                        latitude: 0, 
                        longitude: 0 
                    }
                } : null,
                message: descriptionRef.current?.value || null,
                isHistoric: false
            };
            
            await submitReport.mutateAsync(report);
            
            // Show summary modal instead of resetting form immediately
            setReportedData(report);
            setShowSummary(true);
            
        } catch (error) {
            console.error('Error submitting report:', error);
            // Show error to user (could be enhanced)
            if (error == "Error: HTTP error! status: 429") {
                alert('Bitte nicht so schnell! Warte 30 Minuten und versuche es erneut.');
            } else {
                alert('Fehler beim Senden der Meldung. Bitte versuche es erneut.');
            }
        }
    };

    const handleCloseSummary = () => {
        setShowSummary(false);
        setReportedData(null);
        
        // Reset form after closing summary
        setCurrentEntity(null);
        setCurrentLine(null);
        setCurrentStation(null);
        setCurrentDirection(null);
        setStationSearch('');
        setDescription('');
        setIsPrivacyChecked(false);
    };

    if (isLoadingStations || isLoadingLines) {
        return <div>Loading form data...</div>;
    }

    // Helper function to get value from a Line component
    const getLineValue = (child: React.ReactElement) => child.props.line;
    
    // Show summary modal if report was submitted
    if (showSummary && reportedData) {
        return (
            <ReportSummaryModal
                reportData={reportedData}
                openAnimationClass="open center-animation"
                handleCloseModal={handleCloseSummary}
                numberOfUsers={numberOfUsers}
            />
        );
    }

    return (
        <div className="report-form container modal" ref={containerRef}>
            <form onSubmit={handleSubmit}>
                <div style={{ width: '100%', overflow: 'visible' }}>
                    <div ref={topElementsRef}>
                        <div className="align-child-on-line">
                            <h1>Neue Meldung</h1>
                        </div>
                        <section className="selector-container">
                            <SelectField
                                containerClassName="align-child-on-line large-selector"
                                fieldClassName="entity-type-selector"
                                onSelect={handleEntitySelect}
                                value={currentEntity}
                                getValue={() => "U"}
                            >
                                <span className="line" style={{ backgroundColor: getLineColor('U8') }}>
                                    <strong>U</strong>
                                </span>
                            </SelectField>
                            <SelectField
                                containerClassName="align-child-on-line large-selector"
                                fieldClassName="entity-type-selector"
                                onSelect={handleEntitySelect}
                                value={currentEntity}
                                getValue={() => "S"}
                            >
                                <span className="line" style={{ backgroundColor: getLineColor('S2') }}>
                                    <strong>S</strong>
                                </span>
                            </SelectField>
                            <SelectField
                                containerClassName="align-child-on-line large-selector"
                                fieldClassName="entity-type-selector"
                                onSelect={handleEntitySelect}
                                value={currentEntity}
                                getValue={() => "M"}
                            >
                                <span className="line" style={{ backgroundColor: getLineColor('M1') }}>
                                    <strong>M</strong>
                                </span>
                            </SelectField>
                        </section>
                        {currentEntity && possibleLines.length > 0 && (
                            <section className="line-selector">
                                <h2>Linie</h2>
                                <SelectField
                                    containerClassName="align-child-on-line long-selector"
                                    onSelect={handleLineSelect}
                                    value={currentLine}
                                    getValue={getLineValue}
                                >
                                    {possibleLines.map(([line]) => (
                                        <Line key={line} line={line} />
                                    ))}
                                </SelectField>
                            </section>
                        )}
                    </div>
                    
                    {/* Station selector */}
                    <section className="station-selector">
                        <h2>Station <span className="red-highlight">*</span></h2>
                        <input
                            className="station-input"
                            type="text"
                            placeholder="Station suchen..."
                            value={stationSearch}
                            onChange={(e) => setStationSearch(e.target.value)}
                        />
                        <div className="station-list">
                            <SelectField
                                onSelect={handleStationSelect}
                                value={currentStation}
                                getValue={(child) => child.props.id}
                            >
                                {Object.entries(possibleStations).map(([stationId, stationData]) => (
                                    <div key={stationId} id={stationId}>
                                        {stationData.name}
                                    </div>
                                ))}
                            </SelectField>
                        </div>
                    </section>
                    
                    <div ref={bottomElementsRef}>
                        {/* Direction selector */}
                        {currentLine !== null &&
                        currentLine !== 'S41' &&
                        currentLine !== 'S42' &&
                        currentStation !== null ? (
                            <section>
                                <h3>Richtung</h3>
                                <SelectField
                                    onSelect={handleDirectionSelect}
                                    value={currentDirection}
                                    containerClassName="align-child-on-line"
                                    getValue={(child) => child.props.id}
                                >
                                    {possibleDirections.map((direction) => (
                                        <div key={direction.id} id={direction.id}>
                                            <strong>{direction.name}</strong>
                                        </div>
                                    ))}
                                </SelectField>
                            </section>
                        ) : null}
                        
                        {/* Description field */}
                        {currentStation && (
                            <section className="description-field">
                                <h3>Beschreibung</h3>
                                <textarea
                                    ref={descriptionRef}
                                    placeholder="Beschreibung"
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </section>
                        )}
                        
                        {/* Privacy checkbox and submit button */}
                        <section>
                            <div>
                                {currentStation && (
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isPrivacyChecked}
                                            onChange={() => setIsPrivacyChecked(!isPrivacyChecked)}
                                        />
                                        Ich stimme der <a href="https://app.freifahren.org/datenschutz">Datenschutzerklärung</a> zu.
                                    </label>
                                )}
                            </div>
                            <div>
                                <button
                                    type="submit"
                                    className={isPrivacyChecked && currentStation !== null ? '' : 'button-gray'}
                                    disabled={!isFormValid()}
                                >
                                    Melden
                                </button>
                                <p className="disclaimer">Deine Meldung wird mit @FreiFahren_BE synchronisiert.</p>
                            </div>
                        </section>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default ReportForm; 