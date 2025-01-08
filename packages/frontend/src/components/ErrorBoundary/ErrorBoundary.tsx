import './ErrorBoundary.css'

import React from 'react'
import * as Sentry from '@sentry/react'

interface ErrorBoundaryProps {
    children: React.ReactNode
}

interface ErrorBoundaryState {
    hasError: boolean
}

class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props)
        this.state = { hasError: false }
    }

    static getDerivedStateFromError(): ErrorBoundaryState {
        return { hasError: true }
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        Sentry.captureException(error, {
            extra: {
                componentStack: errorInfo.componentStack,
            },
        })
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return (
                <div className="modal container center-child" style={{ display: 'flex', opacity: 1 }}>
                    <div className="align-child-column">
                        <h1>Oops! Etwas ist schiefgelaufen</h1>
                        <p>
                            Ein unerwarteter Fehler ist aufgetreten. Wir wurden benachrichtigt und arbeiten an einer
                            Lösung.
                        </p>
                        <button
                            className="action"
                            onClick={() => {
                                this.setState({ hasError: false })
                                window.location.reload()
                            }}
                        >
                            Seite neu laden
                        </button>
                    </div>
                </div>
            )
        }

        return this.props.children
    }
}

export { ErrorBoundary }
