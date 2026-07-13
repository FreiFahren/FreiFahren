import { useSyncExternalStore } from 'react';

import { Capacitor } from '@capacitor/core';

import { ONBOARDING_STEPS, type OnboardingStep } from '@/components/onboarding/steps';

// Generic orchestrator: shows the first step whose isRequired() is true and re-checks when any step
// signals a change. All per-step knowledge lives in the registry (components/onboarding/steps).

// null = complete; 'pending' is the native cold start where a step looks outstanding but might be a
// purged WebView — steps restore from durable storage before anything shows.
type OnboardingState = OnboardingStep | null | 'pending';

let state: OnboardingState = resolveInitialState();
const listeners = new Set<() => void>();

for (const step of ONBOARDING_STEPS) {
  step.subscribe(() => {
    if (state === 'pending') return;
    const next = currentStep();
    if (next === state) return;
    state = next;
    notify();
  });
}

function currentStep(): OnboardingStep | null {
  return ONBOARDING_STEPS.find((step) => step.isRequired()) ?? null;
}

function notify(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function resolveInitialState(): OnboardingState {
  const step = currentStep();
  if (!step || !Capacitor.isNativePlatform()) return step;
  void restore();
  return 'pending';
}

async function restore(): Promise<void> {
  const restored = await Promise.all(ONBOARDING_STEPS.map((step) => step.restore()));
  if (restored.some(Boolean)) {
    // Reload so the boot-time readers (lib/city, lib/legal-disclaimer) resolve with the recovered
    // value.
    window.location.reload();
    return;
  }
  state = currentStep();
  notify();
}

export function useCurrentOnboardingStep(): OnboardingState {
  return useSyncExternalStore(subscribe, () => state);
}

export function useOnboardingComplete(): boolean {
  return useSyncExternalStore(subscribe, () => state === null);
}
