import './index.css'
import './tailwind.css'

import { QueryClientProvider } from '@tanstack/react-query'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { queryClient } from './api/queryClient'
import { LocationProvider } from './contexts/LocationContext'
import { i18n } from './i18n'
import { App } from './pages/App/App'
import { Impressum } from './pages/Impressum/Impressum'
import { PrivacyPolicy } from './pages/PrivacyPolicy/PrivacyPolicy'
import { Support } from './pages/Support/Support'
import { reportWebVitals } from './reportWebVitals'

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
                        <Route path="/impressum" element={<Impressum />} />
                        <Route path="/datenschutz" element={<PrivacyPolicy />} />
                        <Route path="/support" element={<Support />} />
                    </Routes>
                </BrowserRouter>
            </QueryClientProvider>
        </I18nextProvider>
    </React.StrictMode>
)

reportWebVitals()
