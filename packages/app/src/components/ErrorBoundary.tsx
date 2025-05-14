import { Component, ReactNode } from 'react'

import { ErrorFallbackScreen } from './common/ErrorFallbackScreen'

interface Props {
    children: ReactNode
}

interface State {
    hasError: boolean
    error: Error | null
}

class ErrorBoundary extends Component<Props, State> {
    constructor(props: Props) {
        super(props)
        this.state = {
            hasError: false,
            error: null,
        }
    }

    public static getDerivedStateFromError(error: Error): Partial<State> {
        return { hasError: true, error }
    }

    public render() {
        const { hasError, error } = this.state
        const { children } = this.props

        if (hasError) {
            return <ErrorFallbackScreen error={error} />
        }

        return children
    }
}

export { ErrorBoundary }
