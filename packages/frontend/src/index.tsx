import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, Routes, Route } from 'react-router-dom'

import './index.css'
import App from './pages/App/App'
import Impressum from './pages/Impressum/Impressum'
import reportWebVitals from './reportWebVitals'

import { LocationProvider } from './contexts/LocationContext'

import { I18nextProvider } from 'react-i18next'
import i18n from './i18n'
import Support from './pages/Support/Support'
import PrivacyPolicy from './pages/PrivacyPolicy/PrivacyPolicy'

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
                </Routes>
            </BrowserRouter>
        </I18nextProvider>
    </React.StrictMode>
)

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals()
