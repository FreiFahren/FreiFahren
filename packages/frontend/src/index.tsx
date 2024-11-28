import './index.css'

import React from 'react'
import ReactDOM from 'react-dom/client'
import { I18nextProvider } from 'react-i18next'
import { BrowserRouter, Route, Routes } from 'react-router-dom'

import { LocationProvider } from './contexts/LocationContext'
import i18n from './i18n'
import { App } from './pages/App/App'
import { Impressum } from './pages/Impressum/Impressum'
import { PrivacyPolicy } from './pages/PrivacyPolicy/PrivacyPolicy'
import { Support } from './pages/Support/Support'
import { reportWebVitals } from './reportWebVitals'

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
