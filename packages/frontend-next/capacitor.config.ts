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
  },
};

export default config;
