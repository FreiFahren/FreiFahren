import { removeNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

export type AutoSwitchCityPreference = 'always' | 'never';

const KEY = 'freifahren.autoSwitchCity';
export const RESET_AUTO_SWITCH_PARAM = 'resetAutoSwitch';
const RESET_WINDOW_NAME = 'ff-reset-auto-switch-city';

function parse(value: string | null): AutoSwitchCityPreference | null {
  return value === 'always' || value === 'never' ? value : null;
}

function expireLegacyCookie(): void {
  if (typeof document === 'undefined') return;
  if (!document.cookie.split('; ').some((row) => row.startsWith(`${KEY}=`))) return;
  document.cookie = `${KEY}=; Path=/; Max-Age=0`;
  if (typeof window !== 'undefined' && window.location.hostname.endsWith('.freifahren.org')) {
    document.cookie = `${KEY}=; Path=/; Max-Age=0; Domain=.freifahren.org`;
  }
}

export function getAutoSwitchCityPreference(): AutoSwitchCityPreference | null {
  expireLegacyCookie();
  return parse(safeLocalStorage.getItem(KEY));
}

export function setAutoSwitchCityPreference(value: AutoSwitchCityPreference): void {
  expireLegacyCookie();
  void saveNativePreference(KEY, value);
}

export function clearAutoSwitchCityPreference(): void {
  expireLegacyCookie();
  void removeNativePreference(KEY);
}

export function markResetAutoSwitchCity(): void {
  if (typeof window === 'undefined') return;
  window.name = RESET_WINDOW_NAME;
}

function consumeResetAutoSwitchCity(): void {
  if (typeof window === 'undefined') return;
  const url = new URL(window.location.href);
  const fromQuery = url.searchParams.has(RESET_AUTO_SWITCH_PARAM);
  const fromName = window.name === RESET_WINDOW_NAME;
  if (!fromQuery && !fromName) return;

  if (fromName) window.name = '';
  if (fromQuery) {
    url.searchParams.delete(RESET_AUTO_SWITCH_PARAM);
    window.history.replaceState(
      window.history.state,
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  }
  clearAutoSwitchCityPreference();
}

consumeResetAutoSwitchCity();
