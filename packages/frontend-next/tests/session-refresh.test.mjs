import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { before, test } from 'node:test';
import { createContext, SourceTextModule } from 'node:vm';
import { build } from 'vite';

const root = fileURLToPath(new URL('../', import.meta.url));
const tokenKey = 'freifahren-session-token';
const accountKey = 'freifahren-account-id';
const reloadKey = 'vite:preloadError:lastReload';
let output;

// Bundle the real session and recovery modules with Vite's production preload helper. Only their
// surrounding providers are replaced; the import, event cancellation and catch behavior are real.
before(async () => {
  const modules = {
    'test:entry': `
      export { refreshSessionAccount } from '@/lib/session';
      export { initPreloadRecovery } from '@/lib/preload-recovery';
      export const loadAuthClient = () => import('@/lib/auth-client');
    `,
    '@/lib/auth-client': `
      export const authClient = { $store: { atoms: { session: { get: () => ({
        refetch: async () => {
          globalThis.testState.refetches++;
          if (globalThis.testState.refetchError) throw globalThis.testState.refetchError;
        },
      }) } } } };
    `,
    '@/lib/native-preference': `
      export async function restoreNativePreference() {
        if (globalThis.testState.restoreError) throw globalThis.testState.restoreError;
        return false;
      }
      export async function saveNativePreference(key, value) { localStorage.setItem(key, value); }
      export async function removeNativePreference(key) { localStorage.removeItem(key); }
    `,
    '@/lib/feature-flags': `
      export const FEATURE_FLAGS = { accounts: 'accounts' };
      export function useFeatureFlag() {}
    `,
    '@/lib/posthog-client': 'export function setPostHogFlagAccount() {}',
    '@/lib/utils': 'export const optionalEnv = () => globalThis.testState.authUrl;',
    '@/lib/error-monitoring': `
      export function captureException(error) { globalThis.testState.captured.push(error); }
    `,
    react: 'export function useSyncExternalStore() {}',
  };
  const result = await build({
    configFile: false,
    root,
    logLevel: 'silent',
    plugins: [
      {
        name: 'session-refresh-test-providers',
        resolveId(id) {
          if (Object.hasOwn(modules, id)) return `\0${id}`;
          if (id.startsWith('@/')) return `${root}src/${id.slice(2)}.ts`;
        },
        load(id) {
          return modules[id.slice(1)];
        },
      },
    ],
    build: {
      write: false,
      minify: false,
      rolldownOptions: { input: 'test:entry', preserveEntrySignatures: 'strict' },
    },
  });
  output = result.output;
});

function storage(values = []) {
  const entries = new Map(values);
  return {
    getItem: (key) => entries.get(key) ?? null,
    setItem: (key, value) => entries.set(key, value),
    removeItem: (key) => entries.delete(key),
  };
}

async function start({
  signedIn = true,
  online = true,
  recentReload = false,
  name = '',
  ...state
} = {}) {
  const testState = {
    authUrl: 'https://auth.example.invalid',
    imports: 0,
    refetches: 0,
    reloads: 0,
    captured: [],
    events: [],
    ...state,
  };
  const localStorage = storage(
    signedIn
      ? [
          [tokenKey, 'test-token'],
          [accountKey, 'test-account'],
        ]
      : [],
  );
  const sessionStorage = storage(recentReload ? [[reloadKey, String(Date.now())]] : []);
  const window = new EventTarget();
  window.name = name;
  window.location = { reload: () => testState.reloads++ };
  window.addEventListener('vite:preloadError', (event) => testState.events.push(event));
  const context = createContext({
    Event,
    window,
    navigator: { onLine: online },
    localStorage,
    sessionStorage,
    document: { querySelector: () => null, getElementsByTagName: () => [] },
    testState,
  });
  const modules = new Map();
  const load = async (filename) => {
    if (modules.has(filename)) return modules.get(filename);
    const chunk = output.find((item) => item.fileName === filename);
    assert.ok(chunk && chunk.type === 'chunk');
    const module = new SourceTextModule(chunk.code, {
      context,
      identifier: filename,
      importModuleDynamically: async (specifier, referencingModule) => {
        testState.imports++;
        if (testState.importError) throw testState.importError;
        const imported = await resolve(specifier, referencingModule);
        await imported.evaluate();
        return imported;
      },
    });
    modules.set(filename, module);
    await module.link(resolve);
    return module;
  };
  const resolve = (specifier, referencingModule) =>
    load(new URL(specifier, `file:///${referencingModule.identifier}`).pathname.slice(1));
  const entry = await load(output.find((item) => item.type === 'chunk' && item.isEntry).fileName);
  await entry.evaluate();
  entry.namespace.initPreloadRecovery();
  return { api: entry.namespace, state: testState, localStorage, sessionStorage, window };
}

function assertSessionRetained(app) {
  assert.equal(app.localStorage.getItem(tokenKey), 'test-token');
  assert.equal(app.localStorage.getItem(accountKey), 'test-account');
}

test('a stored session refreshes once after a successful lazy import', async () => {
  const app = await start();
  await app.api.refreshSessionAccount();
  assert.equal(app.state.imports, 1);
  assert.equal(app.state.refetches, 1);
  assert.deepEqual(app.state.captured, []);
  assertSessionRetained(app);
});

for (const [name, options] of [
  ['signed out', { signedIn: false }],
  ['auth disabled', { authUrl: undefined }],
]) {
  test(`${name}: skip the auth import`, async () => {
    const app = await start({ ...options, importError: new Error('injected import failure') });
    await app.api.refreshSessionAccount();
    assert.equal(app.state.imports, 0);
    assert.equal(app.state.refetches, 0);
    assert.deepEqual(app.state.captured, []);
  });
}

for (const [name, options, reloads] of [
  ['offline', { online: false }, 0],
  ['recent reload', { recentReload: true }, 0],
  ['window reload marker', { name: 'ff-preload-reload' }, 0],
  ['online recovery', {}, 1],
]) {
  test(`${name}: handle the original import failure and retain the session`, async () => {
    const original = new TypeError('injected import failure');
    const app = await start({ ...options, importError: original });
    await app.api.refreshSessionAccount();
    assert.equal(app.state.refetches, 0);
    assert.equal(app.state.reloads, reloads);
    assert.equal(app.state.captured.length, 1);
    assert.equal(app.state.captured[0], original);
    assert.equal(app.state.events.length, 1);
    assert.equal(app.state.events[0].payload, original);
    assert.equal(app.state.events[0].defaultPrevented, false);
    assertSessionRetained(app);
    if (reloads) {
      assert.equal(app.window.name, 'ff-preload-reload');
      assert.ok(Number(app.sessionStorage.getItem(reloadKey)) > 0);
    }
  });
}

test('other lazy-import callers still receive the original rejection', async () => {
  const original = new TypeError('injected import failure');
  const app = await start({ online: false, importError: original });
  await assert.rejects(app.api.loadAuthClient(), (error) => error === original);
  assert.deepEqual(app.state.captured, []);
});

for (const source of ['restoreError', 'refetchError']) {
  test(`${source}: handle failure without clearing the stored session`, async () => {
    const original = new Error('injected provider failure');
    const app = await start({ [source]: original });
    await app.api.refreshSessionAccount();
    assert.equal(app.state.captured.length, 1);
    assert.equal(app.state.captured[0], original);
    assert.equal(app.state.refetches, source === 'refetchError' ? 1 : 0);
    assertSessionRetained(app);
  });
}
