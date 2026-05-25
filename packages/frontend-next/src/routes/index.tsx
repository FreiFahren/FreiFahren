import { createFileRoute } from '@tanstack/react-router';
import { Map } from '@/components/map/Map';

export const Route = createFileRoute('/')({
  component: HomeComponent,
});

function HomeComponent() {
  return <Map />;
}
