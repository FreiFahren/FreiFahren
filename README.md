<div align="center">
  <img src="packages/frontend/public/logo-with-text.png" alt="FreiFahren" width="480" />

  <p>Die Blitzer-App für Öffis. Die Live-Karte der Ticketkontrolleure im Berliner Nahverkehr</p>

  [![Telegram](https://img.shields.io/badge/Telegram-Community-26A5E4?logo=telegram&logoColor=white)](https://t.me/freifahren_BE)
  [![License](https://img.shields.io/github/license/brandesdavid/FreiFahren)](LICENSE)
  [![Frontend CI](https://github.com/brandesdavid/FreiFahren/actions/workflows/frontend-next-ci.yml/badge.svg)](https://github.com/brandesdavid/FreiFahren/actions/workflows/frontend-next-ci.yml)
  [![Backend CI](https://github.com/brandesdavid/FreiFahren/actions/workflows/run-backend-ci.yml/badge.svg)](https://github.com/brandesdavid/FreiFahren/actions/workflows/run-backend-ci.yml)
</div>

---

## What is FreiFahren?

FreiFahren crowdsources real-time sightings of ticket inspectors across the Berlin public transport network. Reports flow in from the in-app form or the [Freifahren Telegram group](https://t.me/freifahren_BE); The community keeps the map accurate.

<div align="center">
  <img src="docs/readme_assets/screenshot1.png" alt="FreiFahren map with reports" width="240" />
  &nbsp;&nbsp;
  <img src="docs/readme_assets/screenshot2.png" alt="FreiFahren map overview" width="240" />
</div>

---

## How it works

1. **Report**: community members spot a ticket inspector and submit the station, line and direction via the web app or the [Telegram group](https://t.me/freifahren_BE)
2. **Process**: the backend validates the report and writes it to the database
3. **Display**: the live map updates in real-time so everyone can see where inspectors are right now

## Contact

Questions or feedback? Reach us at [contact@freifahren.org](mailto:contact@freifahren.org).

Or personally via [johan@freifahren.org](mailto:johan@freifahren.org), [moritz@freifahren.org](mailto:moritz@freifahren.org) or [david@freifahren.org](mailto:david@freifahren.org).
