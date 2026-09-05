/* eslint-disable react-refresh/only-export-components -- Standalone browser test entry point. */
import { createRoot } from 'react-dom/client';
import { GeolocationProvider } from '../../src/contexts/GeolocationProvider';
import { useGeolocation } from '../../src/contexts/Geolocation.context';
import {
  useMapLocationSharing,
  useReportLocationSharing,
} from '../../src/hooks/use-location-sharing';

function MapFlow() {
  const { visible, allow } = useMapLocationSharing({ enabled: true, canDisplay: true });
  return visible && <button onClick={allow}>Use location</button>;
}
function ReportFlow() {
  const { phase, allow } = useReportLocationSharing();
  return (
    <>
      <span>{phase}</span>
      {phase === 'prompt' && <button onClick={allow}>Use location</button>}
    </>
  );
}
function Harness() {
  const { status } = useGeolocation();
  return (
    <>
      <output>{status}</output>
      {location.search.includes('report') ? <ReportFlow /> : <MapFlow />}
    </>
  );
}
createRoot(document.getElementById('root')!).render(
  <GeolocationProvider>
    <Harness />
  </GeolocationProvider>,
);
