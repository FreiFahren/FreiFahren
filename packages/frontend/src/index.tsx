import './index.css'
import './tailwind.css'

import { browserTracingIntegration, init, replayIntegration } from '@sentry/react'
import { QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { queryClient } from './api/queryClient'
import { LocationProvider } from './contexts/LocationContext'
import { i18n } from './i18n'
import { App } from './pages/App/App'
import { PrivacyPolicy } from './pages/PrivacyPolicy/PrivacyPolicy'
import { Support } from './pages/Support/Support'
import { reportWebVitals } from './reportWebVitals'

if (import.meta.env.PROD) {
    init({
        dsn: 'https://555d2661f0b147345e2117aad784560c@o4508609338867712.ingest.de.sentry.io/4508609341161552',
        integrations: [browserTracingIntegration(), replayIntegration()],
        // Tracing
        tracesSampleRate: 1.0, //  Capture 100% of the transactions
        // Set 'tracePropagationTargets' to control for which URLs distributed tracing should be enabled
        tracePropagationTargets: ['localhost', /^https:\/\/yourserver\.io\/api/],
        // Session Replay
        replaysSessionSampleRate: 0.1, // This sets the sample rate at 10%. You may want to change it to 100% while in development and then sample at a lower rate in production.
        replaysOnErrorSampleRate: 1.0, // If you're not already sampling the entire session, change the sample rate to 100% when sampling sessions where errors occur.
    })
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
    <React.StrictMode>
        <I18nextProvider i18n={i18n}>
            <QueryClientProvider client={queryClient}>
                <BrowserRouter>
                    <Routes>
                        <Route
                            path="/"
                            element={
                                <LocationProvider>
                                    <App />
                                </LocationProvider>
                            }
                        />
                        <Route
                            path="/station/:stationId"
                            element={
                                <LocationProvider>
                                    <App />
                                </LocationProvider>
                            }
                        />
                        <Route path="/datenschutz" element={<PrivacyPolicy />} />
                        <Route path="/support" element={<Support />} />
                    </Routes>
                </BrowserRouter>
            </QueryClientProvider>
        </I18nextProvider>
    </React.StrictMode>
)

reportWebVitals()
