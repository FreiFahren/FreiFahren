import React, { useEffect, useState, useMemo } from 'react'

import { MarkerData } from '../../Map/Markers/MarkerContainer'
import { elapsedTimeMessage, stationDistanceMessage } from '../../../utils/mapUtils';
import { getStationDistance } from '../../../utils/dbUtils';
//import LoadingPlaceholder from '../../Miscellaneous/LoadingPlaceholder/LoadingPlaceholder';
import './MarkerModal.css'

interface MarkerModalProps {
  selectedMarker: MarkerData,
  className: string,
  userLat?: number,
  userLng?: number,
  children?: React.ReactNode
}

const MarkerModal: React.FC<MarkerModalProps> = ({ className, children, selectedMarker, userLat, userLng }) => {
  const { timestamp, station, line, direction, isHistoric } = selectedMarker;

  const adjustedTimestamp = useMemo(() => {
    const tempTimestamp = new Date(timestamp);
    return tempTimestamp;
  }, [timestamp]);
  const currentTime = new Date().getTime();
  const elapsedTime = currentTime - adjustedTimestamp.getTime();

  //const [isLoading, setIsLoading] = useState(false);
  const [stationDistance, setStationDistance] = useState<number | null>(null);
  useEffect(() => {
    const fetchDistance = async () => {
        //setIsLoading(true);
        const distance = await getStationDistance(userLat, userLng, station.id);
        setStationDistance(distance);
        //setIsLoading(false);
    };

    fetchDistance();
}, [userLat, userLng, station.id]);

  return (
    <div className={`marker-modal info-popup modal ${className}`}>
      {children}
      <h1>{station.name}</h1>
      {(direction.name !== '' || line !== '' ) && <h2><span className={line}>{line}</span> {direction.name}</h2> }
      <div>
        <p>{elapsedTimeMessage(elapsedTime, isHistoric)}</p>
        <p className='distance'>
          {stationDistanceMessage(stationDistance)}
        </p>
        {selectedMarker.message && <p className='description'>{selectedMarker.message}</p>}
      </div>
    </div>
  )
}

export default MarkerModal
