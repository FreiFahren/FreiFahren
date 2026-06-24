import type { CapacitorConfig } from '@capacitor/cli';
import { KeyboardResize } from '@capacitor/keyboard';

const config: CapacitorConfig = {
  appId: 'com.anonymous.Freifahren',
  appName: 'FreiFahren',
  webDir: 'dist',
  plugins: {
    // The map is a full-bleed `position: fixed; inset: 0` layer and both text inputs (map search,
    // report station search) sit at the top of the screen, so the keyboard can simply overlay the
    // bottom — nothing needs to shrink. `None` stops iOS from resizing the WebView frame on focus,
    // which on some devices/OS versions fails to restore after dismissal and leaves a black band
    // where the keyboard was (reported on iPhone 16 Pro / iOS 27).
    Keyboard: {
      resize: KeyboardResize.None,
    },
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
