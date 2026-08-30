import { Capacitor } from '@capacitor/core';

import { removeNativePreference, saveNativePreference } from '@/lib/native-preference';
import { safeLocalStorage } from '@/lib/safe-storage';

export type AutoSwitchCityPreference = 'always' | 'never';

const KEY = 'freifahren.autoSwitchCity';
const YEAR_SECONDS = 60 * 60 * 24 * 365;
export const RESET_AUTO_SWITCH_PARAM = 'resetAutoSwitch';
const RESET_WINDOW_NAME = 'ff-reset-auto-switch-city';

function parse(value: string | null): AutoSwitchCityPreference | null {
  return value === 'always' || value === 'never' ? value : null;
}

function usesCrossSubdomainCookie(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.freifahren.org');
}

function readCookie(): string | null {
  if (typeof document === 'undefined') return null;
  const prefix = `${KEY}=`;
  const found = document.cookie.split('; ').find((row) => row.startsWith(prefix));
  return found === undefined ? null : found.slice(prefix.length);
}

function writeCookie(value: AutoSwitchCityPreference): void {
  if (typeof document === 'undefined' || !usesCrossSubdomainCookie()) return;
  const parts = [
    `${KEY}=${value}`,
    'Path=/',
    `Max-Age=${YEAR_SECONDS}`,
    'SameSite=Lax',
    'Secure',
    'Domain=.freifahren.org',
  ];
  document.cookie = parts.join('; ');
}

function expireCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${KEY}=; Path=/; Max-Age=0`;
  if (usesCrossSubdomainCookie()) {
    document.cookie = `${KEY}=; Path=/; Max-Age=0; Domain=.freifahren.org`;
  }
}

export function getAutoSwitchCityPreference(): AutoSwitchCityPreference | null {
  if (!usesCrossSubdomainCookie()) {
    if (readCookie() !== null) expireCookie();
    return parse(safeLocalStorage.getItem(KEY));
  }
  return parse(readCookie()) ?? parse(safeLocalStorage.getItem(KEY));
}

export function setAutoSwitchCityPreference(value: AutoSwitchCityPreference): void {
  if (!Capacitor.isNativePlatform()) writeCookie(value);
  void saveNativePreference(KEY, value);
}

export function clearAutoSwitchCityPreference(): void {
  expireCookie();
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
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  }
  clearAutoSwitchCityPreference();
}

consumeResetAutoSwitchCity();
