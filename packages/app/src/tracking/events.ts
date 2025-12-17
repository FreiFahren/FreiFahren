type BaseEvent = {}

export type Event = BaseEvent &
    (
        | { name: 'App Opened' }
        | { name: 'Reports Viewed' }
        | { name: 'Report Tapped'; station: string }
        | { name: 'Layer Selected'; layer: 'risk' | 'lines' }
        | { name: 'Report Sheet Opened' }
        | { name: 'Language Switched'; language: string }
        | { name: 'Privacy Policy Viewed'; from: string }
        | { name: 'Support Page Viewed'; from: string }
        | { name: 'Settings Opened' }
        | { name: 'Disclaimer Viewed' }
        | { name: 'Disclaimer Dismissed' }
        | { name: 'Privacy Policy Blocker Shown' }
        | { name: 'Privacy Policy Accepted' }
        | { name: 'App Store Opened' }
        | { name: 'App Deprecated' }
        | { name: 'Navigation Opened' }
        | { name: 'Error Retry Attempted' }
        | {
              name: 'Missing Station'
              stationId: string
              version: string
              location: string
              exampleKnownStationId: string
          }
        | {
              name: 'Report Submitted'
              duration: number
              line: string | null
              stationId: string
              directionId: string | null
          }
    )
