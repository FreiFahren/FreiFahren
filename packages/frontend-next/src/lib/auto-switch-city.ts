import { removeNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

export type AutoSwitchCityPreference = 'always' | 'never';

const KEY = 'freifahren.autoSwitchCity';
export const RESET_AUTO_SWITCH_PARAM = 'resetAutoSwitch';
const RESET_WINDOW_NAME = 'ff-reset-auto-switch-city';

function parse(value: string | null): AutoSwitchCityPreference | null {
  return value === 'always' || value === 'never' ? value : null;
}

export function getAutoSwitchCityPreference(): AutoSwitchCityPreference | null {
  return parse(safeLocalStorage.getItem(KEY));
}

export function setAutoSwitchCityPreference(value: AutoSwitchCityPreference): void {
  void saveNativePreference(KEY, value);
}

export function clearAutoSwitchCityPreference(): void {
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
