import React, { useState, useEffect } from 'react';
import './Skeleton.css';

interface UseSkeletonProps {
    isLoading: boolean;
    initialDelay?: number;
    minDisplayTime?: number;
}

/**
 * Custom hook to manage the display logic for a skeleton loading placeholder.
 *
 * This hook implements a smart loading state that helps prevent flickering
 * for fast-loading content while ensuring a minimum display time for slower loads.
 *
 * @param {Object} props - The properties for the useSkeleton hook.
 * @param {boolean} props.isLoading - Indicates whether the content is currently loading.
 * @param {number} [props.initialDelay=100] - The delay in milliseconds before showing the skeleton.
 * @param {number} [props.minDisplayTime=1000] - The minimum time in milliseconds to display the skeleton once shown.
 *
 * @returns {boolean} A boolean indicating whether the skeleton should be displayed.
 *
 * @example
 * const showSkeleton = useSkeleton({ isLoading: true });
 *
 * // In your component:
 * {showSkeleton ? <Skeleton /> : <ActualContent />}
 */
export const useSkeleton = ({
    isLoading,
    initialDelay = 100,
    minDisplayTime = 1000
  }: UseSkeletonProps) => {
    const [shouldShowSkeleton, setShouldShowSkeleton] = useState(false);
    const [startTime, setStartTime] = useState<number | null>(null);

    useEffect(() => {
      let initialTimer: NodeJS.Timeout; // is used to give the api some time to respond
      let minDisplayTimer: NodeJS.Timeout; // is used to avoid flickering if api responds very quickly after initialTimer

      if (isLoading && !shouldShowSkeleton) {
        initialTimer = setTimeout(() => {
          setShouldShowSkeleton(true);
          setStartTime(Date.now());
        }, initialDelay);
      } else if (shouldShowSkeleton && startTime) {
        const elapsedTime = Date.now() - startTime;
        const remainingTime = Math.max(0, minDisplayTime - elapsedTime);

        minDisplayTimer = setTimeout(() => {
            if (!isLoading) {
              setShouldShowSkeleton(false);
              setStartTime(null);
            }
          }, remainingTime);
        }

        return () => {
          clearTimeout(initialTimer);
          clearTimeout(minDisplayTimer);
        };
      }, [isLoading, shouldShowSkeleton, startTime, initialDelay, minDisplayTime]);

      return shouldShowSkeleton;
};

/**
 * Skeleton component for displaying a loading placeholder.
 *
 * This component renders a simple animated placeholder to indicate
 * that content is loading. It's designed to be used in conjunction
 * with the useSkeleton hook.
 *
 * @returns {JSX.Element} A div containing the skeleton loading animation.
 *
 * @example
 * const showSkeleton = useSkeleton({ isLoading: true });
 *
 * return (
 *   <div>
 *     {showSkeleton ? <Skeleton /> : <ActualContent />}
 *   </div>
 * );
 */
const Skeleton: React.FC = () => {
  return (
    <div className='loading-placeholder'>
      <div className='loading-animation'></div>
    </div>
  );
};

export default Skeleton;