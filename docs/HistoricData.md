# Documentation for Predictive Use of Historic Data in Recent Ticket Inspector Reports API

## Overview

This API endpoint provides up-to-date information on ticket inspector activities at various stations. In situations where recent data is insufficient to provide a comprehensive view, the API employs historic data to fill the gaps. This document outlines the scenarios under which historic data is used and the methodology behind predicting the inspector locations at the stations.

## When Historic Data is Used

Historic data is used under the following conditions:

1. **Data Availability**: When the recent data fetched from the database does not meet a certain threshold, historic data is utilized to supplement the information.
2. **Threshold Calculation**: The threshold for deciding when to use historic data is dynamically calculated based on the time of day and the day of the week. Specific rules include:

-   Weekdays 9 AM to 6 PM: Threshold is highest.
-   Evening Decrement (6 PM to 9 PM): Threshold linearly decreases.
-   Overnight (9 PM to 7 AM): Threshold is at its lowest (1).
-   Morning Increment (7 AM to 9 AM): Threshold increases back to its daytime level.
-   Weekend Adjustment: The threshold decreases by 50% on weekends, reflecting lower inspector activity.

The Rules are based on these Graphs:
![Wochenendhistoriedaten anpassen (1)](https://github.com/FreiFahren/backend/assets/30388999/fe27bee4-b50e-464b-ab08-98ae291faaea)
![Wochenendhistoriedaten anpassen (2)](https://github.com/FreiFahren/backend/assets/30388999/64d33961-41e6-4860-af30-1ffaa95e3335)
![WhatsApp Image 2024-04-24 at 09 36 05 (1)](https://github.com/FreiFahren/backend/assets/30388999/e9748b19-d304-4c17-8148-0230b73745d6)

## Prediction Methodology

When the threshold condition triggers the use of historic data, the API follows this procedure to predict and fetch historic inspector locations:

1. **Data Collection**: The system first gathers a list of all stations from recent data where inspectors have been recorded.
2. **Historic Fetching**:

-   It excludes stations already present in the recent data to avoid duplicates.
-   It then fetches historic data for additional stations, aiming to reach the required data threshold.
-   The number of historic data points fetched is equal to the deficit below the threshold.

3. **Data Integration**:

-   Historic station data is added to the recent data pool.
-   Each historic entry is tagged to distinguish it from real-time data.

4. **Duplicate Handling**:

-   Before final output, the system removes any duplicate entries based on station ID, retaining the entry with the most recent timestamp.

## Conclusion

This predictive use of historic data ensures that the API provides a consistently useful snapshot of ticket inspector locations, even during periods of low activity or data collection shortfalls. This approach helps maintain the utility and relevance of the service across varying temporal patterns.
