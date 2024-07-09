import React, { useState, useEffect } from 'react';
import './Skeleton.css';

interface UseSkeletonProps {
    isLoading: boolean;
    initialDelay?: number;
    minDisplayTime?: number;
}

export const useSkeleton = ({
    isLoading,
    initialDelay = 100,
    minDisplayTime = 1000
  }: UseSkeletonProps) => {
    const [shouldShow, setShouldShow] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    useEffect(() => {
      let initialTimer: NodeJS.Timeout;
      let displayTimer: NodeJS.Timeout;

      if (isLoading && !shouldShow) {
        initialTimer = setTimeout(() => {
          setShouldShow(true);
          setStartTime(Date.now());
        }, initialDelay);
      } else if (shouldShow && startTime) {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

        displayTimer = setTimeout(() => {
            if (!isLoading) {
              setShouldShow(false);
              setStartTime(null);
            }
          }, remainingTime);
        }

        return () => {
          clearTimeout(initialTimer);
          clearTimeout(displayTimer);
        };
      }, [isLoading, shouldShow, startTime, initialDelay, minDisplayTime]);

      return shouldShow;
};

const Skeleton: React.FC = () => {
  return (
    <div className='loading-placeholder'>
      <div className='loading-animation'></div>
    </div>
  );
};

export default Skeleton;