import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom'

import { LocationProvider } from './contexts/LocationContext'
import { sendAnalyticsEvent } from './hooks/useAnalytics'
import i18n from './i18n'
import App from './pages/App/App'
import Impressum from './pages/Impressum/Impressum'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy'
import Support from './pages/Support/Support'
import reportWebVitals from './reportWebVitals'

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

const FunnelRedirect: React.FC<FunnelConfig> = ({ source, path }) => {
    const navigate = useNavigate()

    sendAnalyticsEvent('Clicked on Funnel link', {
        meta: {
            source,
            path,
        },
    })
        .then(() => {
            navigate('/', { replace: true })
        })
        .catch((error) => {
            // eslint-disable-next-line no-console
            console.error('Failed to send analytics event:', error)
            // Still redirect even if the event fails
            navigate('/', { replace: true })
        })

    return null
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
