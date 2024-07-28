import React from 'react';
import { useState, useEffect, useCallback } from 'react';
import './StatsPopUp.css';

interface StatsPopUpProps {
  className: string;
  numberOfReports: number;
}

const StatsPopUp: React.FC<StatsPopUpProps> = ({ className, numberOfReports }) => {
  const [message, setMessage] = useState(`<p><strong>${numberOfReports} Meldungen</strong><br /> heute in Berlin</p>`);
  const [popOut, setPopOut] = useState(false);
  const [isVisible, setIsVisible] = useState(true);

  const timeForOneMessage = 3.5 * 1000;
  const timeForPopOutAnimation = 0.5 * 1000;

  const updateMessageAndShowPopup = async () => {
    setMessage('<p>Über<strong> 26.000 Meldende</strong><br /> in Berlin</p>');
    setPopOut(true);
  };

  const hidePopupAfterAnimation = useCallback(() => {
    setTimeout(() => {
      setPopOut(false);
      setTimeout(() => setIsVisible(false), timeForOneMessage);
    }, timeForPopOutAnimation);
  }, [timeForOneMessage, timeForPopOutAnimation]);

  useEffect(() => {
    const timer = setTimeout(() => {
      updateMessageAndShowPopup().then(hidePopupAfterAnimation);
    }, timeForOneMessage);

    return () => clearTimeout(timer);
  }, [hidePopupAfterAnimation, timeForOneMessage]);

  useEffect(() => {
    if (popOut) {
      const timer = setTimeout(() => setPopOut(false), timeForPopOutAnimation);
      return () => clearTimeout(timer);
    }
  }, [popOut, timeForPopOutAnimation]);

  return (
    <div className={`
        stats-popup center-child ${className} 
        ${popOut ? 'pop-out' : ''}
        ${!isVisible ? 'fade-out' : ''}`}
        dangerouslySetInnerHTML={{ __html: message }} />
  );
};

export default StatsPopUp;
