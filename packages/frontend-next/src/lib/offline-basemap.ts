import type { StyleSpecification } from 'maplibre-gl';
import { createStore, del, get, keys, set } from 'idb-keyval';
import { PMTiles, type Protocol, type RangeResponse, type Source } from 'pmtiles';

// Capacitor-only offline basemap. The native build ships no service worker, so the web app's
// HTTP-cache offline path doesn't apply; instead we persist the full PMTiles archive in IndexedDB
// and read tiles from it locally. IndexedDB (not the Filesystem plugin) holds the ~25 MB archive as
// a Blob with no base64 round-trip and survives WebView cold starts. Imported only behind
// `__CAPACITOR__`, so it never enters the web bundle.

const store = createStore('freifahren-basemap', 'cache');
const STYLE_KEY = 'style';
const ARCHIVE_PREFIX = 'archive:';

/** A pmtiles Source backed by the whole archive held in memory, for offline range reads. */
class BufferSource implements Source {
  private readonly buffer: ArrayBuffer;
  private readonly key: string;

  constructor(buffer: ArrayBuffer, key: string) {
    this.buffer = buffer;
    this.key = key;
  }

  getKey(): string {
    return this.key;
  }

  async getBytes(offset: number, length: number): Promise<RangeResponse> {
    return { data: this.buffer.slice(offset, offset + length) };
  }
}

// The immutable `/v<sha>/` segment makes each deploy's archive a stable cache key.
function archiveKeyFor(archiveUrl: string): string {
  const version = /\/v([^/]+)\//.exec(archiveUrl)?.[1];
  return `${ARCHIVE_PREFIX}${version ?? archiveUrl}`;
}

function archiveUrlFromStyle(style: StyleSpecification): string | null {
  const source = style.sources?.freifahren;
  if (source && source.type === 'vector' && typeof source.url === 'string') {
    return source.url.replace('pmtiles://', '');
  }
  return null;
}

// Fetch the style fresh and persist it; fall back to the last cached copy when offline.
// Network fetch only — persistence is deferred to prepareOfflineBasemap, which pairs the saved style
// with a confirmed-present archive.
async function fetchStyle(styleUrl: string): Promise<StyleSpecification | null> {
  try {
    const res = await fetch(styleUrl);
    if (!res.ok) throw new Error(`style HTTP ${res.status}`);
    return (await res.json()) as StyleSpecification;
  } catch {
    return null;
  }
}

// Drop archives from older deploys so storage tracks only the current version.
async function pruneOldArchives(keepKey: string): Promise<void> {
  const all = await keys(store);
  await Promise.all(
    all
      .filter(
        (k): k is string => typeof k === 'string' && k.startsWith(ARCHIVE_PREFIX) && k !== keepKey,
      )
      .map((k) => del(k, store)),
  );
}

async function downloadArchive(archiveUrl: string, key: string): Promise<void> {
  const res = await fetch(archiveUrl);
  if (!res.ok) throw new Error(`archive HTTP ${res.status}`);
  await set(key, await res.blob(), store);
}

/**
 * Resolve the basemap style and, when a local copy of its PMTiles archive exists, register it with
 * the pmtiles protocol so tiles render with no network. A new deploy's archive is downloaded once in
 * the background — this launch still uses the network via the protocol's default FetchSource — and
 * reused on every later launch, including offline ones. Returns the original URL only as a last
 * resort: a first-ever launch while offline, when nothing is cached yet.
 */
export async function prepareOfflineBasemap(
  styleUrl: string,
  protocol: Protocol,
): Promise<string | StyleSpecification> {
  // Prefer the fresh style; fall back to the last persisted one (which always has its archive) offline.
  const fresh = await fetchStyle(styleUrl);
  const style = fresh ?? (await get<StyleSpecification>(STYLE_KEY, store)) ?? null;
  if (!style) return styleUrl;

  const archiveUrl = archiveUrlFromStyle(style);
  if (!archiveUrl) {
    if (fresh) await set(STYLE_KEY, fresh, store);
    return style;
  }

  const key = archiveKeyFor(archiveUrl);
  const cached = await get<Blob>(key, store);
  if (cached) {
    if (fresh) await set(STYLE_KEY, fresh, store);
    protocol.add(new PMTiles(new BufferSource(await cached.arrayBuffer(), archiveUrl)));
  } else if (fresh && navigator.onLine) {
    // New deploy: its archive isn't downloaded yet. Persist the style only *after* its archive lands,
    // and prune older archives only then — so the persisted style always has a matching archive and an
    // interrupted download can never strand the next offline launch (the prior complete pair stays).
    void downloadArchive(archiveUrl, key)
      .then(() => set(STYLE_KEY, fresh, store))
      .then(() => pruneOldArchives(key))
      .catch(() => {});
  }

  return style;
}
