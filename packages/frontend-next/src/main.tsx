import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from './api/queryClient';
import './lib/i18n';
import { routeTree } from './routeTree.gen';
import './index.css';

// 'viewport' preloads each <Link>'s route (chunk + loader data) once it's on screen via an
// IntersectionObserver — so the pages reachable from the current view warm in the background
const router = createRouter({ routeTree, defaultPreload: 'viewport' });

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
