// MasterPOS: one staff app for every shop on the shared backend (no customer ordering). Identity comes from .env.
const fs = require('fs');

// eas-cli evaluates this file with dotenv loading disabled — read .env here so
// EAS commands also see APP_* and EAS_PROJECT_ID. Variables already set win.
const envFile = require('path').join(__dirname, '.env');
if (fs.existsSync(envFile)) {
  for (const line of fs.readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const name     = process.env.APP_NAME      || 'MasterPOS';
const slug     = process.env.APP_SLUG      || 'masterpos';
const bundleId = process.env.APP_BUNDLE_ID || 'com.sialkotians.masterpos';
const primary  = process.env.EXPO_PUBLIC_PRIMARY_COLOR || '#7fd38b';

const projectId          = process.env.EAS_PROJECT_ID || undefined;
const googleServicesFile = process.env.GOOGLE_SERVICES_FILE || './google-services.json';

module.exports = {
  expo: {
    name,
    slug,
    owner: process.env.EXPO_OWNER || 'zbhaientheo',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/icon.png',
    userInterfaceStyle: 'light',
    splash: {
      image: './assets/splash-icon.png',
      resizeMode: 'contain',
      backgroundColor: '#7fd38b',
    },
    plugins: [
      ['expo-notifications', { color: primary }],
      'expo-system-ui',
      // Product photos and shop logo (staff)
      ['expo-image-picker', { photosPermission: 'Choose photos for your products and shop logo.', cameraPermission: 'Take photos of your products.', microphonePermission: 'Speak orders to add items to the cart.' }],
      // Voice ordering: the phone's own speech recogniser (Google on Android, Apple on iOS)
      ['expo-speech-recognition', {
        microphonePermission: 'Speak orders to add items to the cart.',
        speechRecognitionPermission: 'Turn your spoken orders into cart items.',
      }],
      // Location while the app is open only: customer's spot sent with the order, shop location in settings
      ['expo-location', { locationWhenInUsePermission: "Set your shop's location so the app can tell customers how far away they are.", isAndroidBackgroundLocationEnabled: false, isIosBackgroundLocationEnabled: false }],
      // Embedded icon font so icons never depend on runtime font loading
      ['expo-font', { fonts: ['./assets/fonts/ionicons.ttf'] }],
      './plugins/withNoForceDark',
      // Portrait lock must not hide the app from devices without a portrait screen
      './plugins/withOptionalPortrait',
      // Google Play requires target API level 36 (Android 16)
      ['expo-build-properties', { android: { compileSdkVersion: 36, targetSdkVersion: 36, buildToolsVersion: '36.0.0' } }],
    ],
    ios: {
      supportsTablet: true,
      bundleIdentifier: bundleId,
      infoPlist: { ITSAppUsesNonExemptEncryption: false },
    },
    android: {
      package: bundleId,
      adaptiveIcon: {
        foregroundImage: './assets/adaptive-icon.png',
        backgroundColor: '#7fd38b',
      },
      edgeToEdgeEnabled: true,
      // No ads or ad tracking: keep libraries from adding the advertising ID permission
      blockedPermissions: ['com.google.android.gms.permission.AD_ID'],
      ...(fs.existsSync(googleServicesFile) ? { googleServicesFile } : {}),
    },
    web: { favicon: './assets/favicon.png' },
    extra: {
      ...(projectId ? { eas: { projectId } } : {}),
    },
  },
};
