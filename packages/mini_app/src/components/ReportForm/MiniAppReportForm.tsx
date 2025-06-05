import React, { FC, FormEvent, useCallback, useRef, useState } from 'react';
import './MiniAppReportForm.css';
import { useStations, useLines, useSubmitReport } from '../../api/queries';
import { useStationSearch } from '../../hooks/useStationSearch';
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
                const newValue = value === selectedValue ? null : selectedValue;
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
    const [description, setDescription] = useState<string>('');
    const [isPrivacyChecked, setIsPrivacyChecked] = useState<boolean>(false);
    
    const { searchValue: stationSearch, setSearchValue: setStationSearch, filteredStations: fuzzyFilteredStations } = useStationSearch('');
    
    const [showSummary, setShowSummary] = useState<boolean>(false);
    const [reportedData, setReportedData] = useState<Report | null>(null);
    const [numberOfUsers] = useState<number>(Math.floor(Math.random() * 500) + 100); //mock data for now
    
    const descriptionRef = useRef<HTMLTextAreaElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const topElementsRef = useRef<HTMLDivElement>(null);
    const bottomElementsRef = useRef<HTMLDivElement>(null);
    const stationInputRef = useRef<HTMLInputElement>(null);

    const submitReport = useSubmitReport();

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

    const possibleStations = React.useMemo(() => {
        if (!stations) return {};

        let filteredStations = { ...stations };

        if (currentStation !== null) {
            filteredStations = stations[currentStation] ? { [currentStation]: stations[currentStation] } : {};
        } else if (currentLine !== null) {
            const stationsForLine = lines?.find(([key]) => key === currentLine)?.[1] ?? [];
            filteredStations = Object.fromEntries(
                stationsForLine
                    .map((stationKey) => [stationKey, stations[stationKey]])
                    .filter(([, stationData]) => stationData !== undefined)
            );
        } else if (currentEntity !== null) {
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

        if (stationSearch.trim()) {
            const fuzzyStationIds = Object.keys(fuzzyFilteredStations);
            filteredStations = Object.fromEntries(
                Object.entries(filteredStations).filter(([stationId]) => 
                    fuzzyStationIds.includes(stationId)
                )
            );
        }

        return filteredStations;
    }, [stations, currentEntity, currentLine, currentStation, stationSearch, fuzzyFilteredStations, lines]);

    const getDirections = useCallback((): Station[] => {
        if (!currentLine || !currentStation || !stations || !lines) return [];
        
        if (currentLine === 'S41' || currentLine === 'S42') return [];
        
        const lineStations = lines.find(([line]) => line === currentLine)?.[1] || [];
        
        if (lineStations.length < 2) return [];
        
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
        
        if (currentLine !== null && entity !== null && !currentLine.startsWith(entity)) {
            setCurrentLine(null);
            setCurrentStation(null);
            setCurrentDirection(null);
        }
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
        
        const stationsForSelectedLine = lines?.find(([key]) => key === line)?.[1] ?? [];
        
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
        setCurrentDirection(null);
    }, []);

    const handleDirectionSelect = useCallback((direction: string | null) => {
        setCurrentDirection(direction);
    }, []);

    const handleStationInputFocus = useCallback(() => {
        setTimeout(() => {
            if (stationInputRef.current) {
                stationInputRef.current.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    inline: 'nearest'
                });
            }
        }, 100);
    }, []);

    const isFormValid = useCallback(() => {
        if (!currentStation) return false;
        
        if (!isPrivacyChecked) return false;
        
        return true;
    }, [currentLine, currentStation, currentDirection, possibleDirections, isPrivacyChecked]);

    const handleSubmit = async (event: FormEvent) => {
        event.preventDefault();
        
        if (!isFormValid() || !stations || !currentStation) return;
        
        const stationData = stations[currentStation];
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
        
        submitReport.mutate(report, {
            onSuccess: () => {
                setReportedData(report);
                setShowSummary(true);
            },
            onError: (error: any) => {
                if (error?.message?.includes('429')) {
                    alert('Bitte nicht so schnell! Warte 30 Minuten und versuche es erneut.');
                } else {
                    alert('Fehler beim Senden der Meldung. Bitte versuche es erneut.');
                }
            }
        });
    };

    const handleCloseSummary = () => {
        setShowSummary(false);
    };

    if (isLoadingStations || isLoadingLines) {
        return <div>Loading form data...</div>;
    }

    const getLineValue = (child: React.ReactElement) => child.props.line;
    
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
                    
                    <section className="station-selector">
                        <h2>Station <span className="red-highlight">*</span></h2>
                        <input
                            ref={stationInputRef}
                            className="station-input"
                            type="text"
                            placeholder="Station suchen..."
                            value={stationSearch}
                            onChange={(e) => setStationSearch(e.target.value)}
                            onFocus={handleStationInputFocus}
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
                        
                        <section>
                            <div>
                                {currentStation && (
                                    <label>
                                        <input
                                            type="checkbox"
                                            checked={isPrivacyChecked}
                                            onChange={() => setIsPrivacyChecked(!isPrivacyChecked)}
                                        />
                                        Ich stimme der <a href="https://app.freifahren.org/datenschutz">Datenschutzerklärung</a> zu. <span className="red-highlight">*</span>
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