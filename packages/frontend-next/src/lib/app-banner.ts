import { Capacitor } from '@capacitor/core';
import { useSyncExternalStore } from 'react';

import { safeLocalStorage } from '@/lib/safe-storage';

// Numeric App Store ID (not the bundle id). Keep in sync with the apple-itunes-app tag in index.html.
export const APP_STORE_ID = '6738277309';

export const APP_STORE_URL = `https://apps.apple.com/app/id${APP_STORE_ID}`;

const STORAGE_KEY = 'iosAppBannerDismissed';

function detectIos(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  if (/iP(hone|ad|od)/.test(ua)) return true;
  // iPadOS 13+ reports a Mac user-agent; the touch points give it away.
  return /Mac/.test(ua) && navigator.maxTouchPoints > 1;
}

// Only genuine iOS Safari renders Apple's native Smart App Banner; every other iOS browser (which tags
// itself: CriOS/FxiOS/EdgiOS/OPiOS) and in-app WKWebViews (no "Version/"+"Safari" pair) get our custom
// banner instead, so the two never double up.
function detectIosSafari(ua: string): boolean {
  const isOtherBrowser = /CriOS|FxiOS|EdgiOS|OPiOS|OPT\//.test(ua);
  const hasSafariToken = /Version\//.test(ua) && /Safari/.test(ua);
  return hasSafariToken && !isOtherBrowser;
}

const eligible =
  detectIos() &&
  !Capacitor.isNativePlatform() &&
  typeof navigator !== 'undefined' &&
  !detectIosSafari(navigator.userAgent);

function readDismissed(): boolean {
  return safeLocalStorage.getItem(STORAGE_KEY) === '1';
}

let dismissed = readDismissed();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function shouldShow(): boolean {
  return eligible && !dismissed;
}

export function dismissAppBanner(): void {
  dismissed = true;
  safeLocalStorage.setItem(STORAGE_KEY, '1');
  for (const listener of listeners) listener();
}

export function useShowAppBanner(): boolean {
  return useSyncExternalStore(subscribe, shouldShow);
}
