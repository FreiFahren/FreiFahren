import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.anonymous.Freifahren',
  appName: 'FreiFahren',
  webDir: 'dist',
  plugins: {
    // #2b2b2b matches the app-icon tile so the centered mark blends into the splash background.
    SplashScreen: {
      backgroundColor: '#2b2b2b',
      launchAutoHide: true,
      showSpinner: false,
      launchFadeOutDuration: 200,
    },
    // Self-hosted Capgo over-the-air updates. The Worker at updateUrl answers the version check and
    // serves bundles from R2; we collect no telemetry, so statsUrl is empty to disable the stats POST.
    CapacitorUpdater: {
      autoUpdate: true,
      updateUrl: 'https://updates.freifahren.org/updates',
      statsUrl: '',
      defaultChannel: 'production',
    },
  },
};

export default config;
