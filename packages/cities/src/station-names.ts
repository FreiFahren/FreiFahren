/*
 * German operators mark a stop that serves a rapid transit station with the mode: "S Karlshorst",
 * "S+U Pankow", "U S Barmbek", "Kronenplatz (U)". OSM mappers carry the marker over for some stops
 * and not for others, so within one city the same kind of station is named both ways. The app shows
 * which lines call at a station anyway, so station names are stored without it.
 *
 * No lookbehind, which Safari before 16.4 fails to parse: the character before a trailing marker
 * is captured and put back.
 */
const MODE_MARKER = /^(?:(?:S\+U|U\+S|S|U)\s+)+(?=\S)|(\S)\s+\((?:S\+U|U\+S|S|U)\)$/gu
const TYPED_MODE_MARKER = new RegExp(MODE_MARKER.source, 'giu')

const strip = (value: string, marker: RegExp): string =>
    value.replace(marker, (_match, kept: string | undefined) => kept ?? '')

/** "S Karlshorst" -> "Karlshorst". Case-sensitive, so a name is never cut at a lowercase "s" or "u". */
export const stripModeMarker = (name: string): string => strip(name, MODE_MARKER)

/** The same for what a user typed, in any case: people search for "s karlshorst". */
export const stripTypedModeMarker = (query: string): string => strip(query, TYPED_MODE_MARKER)
