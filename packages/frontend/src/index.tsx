import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import './index.css'
import App from './pages/App/App'
import Impressum from './pages/Impressum/Impressum'
import reportWebVitals from './reportWebVitals'

import { LocationProvider } from './contexts/LocationContext'
import { sendAnalyticsEvent } from './utils/analytics'

import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import Support from './pages/Support/Support'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy'

type FunnelConfig = {
    path: string
    source: string
}

const FUNNEL_ROUTES: FunnelConfig[] = [
    {
        path: '/invite',
        source: 'FreiFahren_BE Telegram',
    },
]

const FunnelRedirect: React.FC<FunnelConfig> = ({ source }) => {
    sendAnalyticsEvent('Clicked on Funnel link', {
        meta: {
            source,
        },
    })

    return <Navigate to="/" replace />
}

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement)

root.render(
    <React.StrictMode>
        <I18nextProvider i18n={i18n}>
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
                    <Route path="/impressum" element={<Impressum />} />
                    <Route path="/datenschutz" element={<PrivacyPolicy />} />
                    <Route path="/support" element={<Support />} />
                    {FUNNEL_ROUTES.map((config) => (
                        <Route key={config.path} path={config.path} element={<FunnelRedirect {...config} />} />
                    ))}
                </Routes>
            </BrowserRouter>
        </I18nextProvider>
    </React.StrictMode>
)

reportWebVitals()
