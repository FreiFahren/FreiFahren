# Source user location solely from the Capacitor Geolocation plugin

## Status

accepted

## Context

The iOS Capacitor build showed **two** native dialogs for a single location request: the
CoreLocation app prompt *and* a WebKit per-origin prompt ("'localhost' would like to use your
location"). These come from two independent permission systems — the Capacitor Geolocation plugin
talks to CoreLocation directly, while maplibre's `GeolocateControl` reads the WebView's
`navigator.geolocation`, which on iOS 15+ WKWebView is gated by *both* CoreLocation authorization
*and* WebKit's own per-site consent. Invoking both (the plugin to pre-authorize, the control to get
a fix) surfaced both dialogs.

## Decision

Request location **only** through `@capacitor/geolocation` on every platform (it delegates to
`navigator.geolocation` on web and to CoreLocation on native), and **render the user-location dot
and accuracy circle ourselves** as a GeoJSON circle layer (`UserLocationLayer`) instead of using
maplibre's `GeolocateControl`. We never call the WebView's `navigator.geolocation` directly, so iOS
shows exactly one native prompt.

## Considered alternatives

- **Keep `GeolocateControl` everywhere** — the dot renders for free, but iOS keeps showing the
  double prompt. Rejected: the double prompt was the whole problem.
- **Plugin on native, `GeolocateControl` on web** — two code paths to maintain and still the double
  prompt on native. Rejected.

## Consequences

- We reimplement the dot + accuracy-circle rendering that `GeolocateControl` provided for free
  (one small GeoJSON layer), and a private-API `_updateCamera` monkey-patch that suppressed the
  control's auto-recentering is no longer needed.
- One permission path and one code path across web and native.
- The accuracy circle is rendered in real ground metres via a zoom-interpolated pixel radius, since
  MapLibre expressions can't compute `cos(lat)` (the latitude term is precomputed in JS).
- We watch with high accuracy on every platform, optimising for phones (which have GPS). Desktop
  browsers without GPS may fail to get a fix (`kCLErrorLocationUnknown` on macOS), but they aren't
  the target.
