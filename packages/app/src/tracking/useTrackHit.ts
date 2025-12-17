import { useEffect } from 'react'

import { Event } from './events'
import { useTracking } from './provider'

export const useTrackHit = (event: Event) => {
    const { track } = useTracking()

    useEffect(() => {
        track(event)
    }, [event, track])
}
