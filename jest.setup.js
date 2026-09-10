jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

jest.mock('react-native-quick-sqlite', () => {
  return {
    open: jest.fn(() => ({
      execute: jest.fn(() => ({rows: []})),
      close: jest.fn(),
    })),
  };
});

jest.mock('react-native-fs', () => {
  return {
    DocumentDirectoryPath: '/mock/documents',
    MainBundlePath: '/mock/bundle',
    readFileAssets: jest.fn(async () => ''),
    readFile: jest.fn(async () => ''),
    writeFile: jest.fn(async () => undefined),
    readDirAssets: jest.fn(async () => []),
    readDir: jest.fn(async () => []),
    exists: jest.fn(async () => false),
    stat: jest.fn(async () => ({size: 0})),
    mkdir: jest.fn(async () => undefined),
    unlink: jest.fn(async () => undefined),
    copyFileAssets: jest.fn(async () => undefined),
    copyFile: jest.fn(async () => undefined),
    moveFile: jest.fn(async () => undefined),
  };
});

jest.mock('react-native-reanimated', () =>
  require('react-native-reanimated/mock')
);

jest.mock('react-native-webview', () => ({
  WebView: 'WebView',
}));

// Inlined rather than pulling in @notifee/react-native/jest-mock, which is
// itself untranspiled and outside the transform allowlist.
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    requestPermission: jest.fn(async () => ({authorizationStatus: 1})),
    getNotificationSettings: jest.fn(async () => ({authorizationStatus: 1})),
    createChannel: jest.fn(async () => 'mock-channel'),
    createTriggerNotification: jest.fn(async () => 'mock-notification'),
    cancelTriggerNotification: jest.fn(async () => undefined),
  },
  AndroidImportance: {DEFAULT: 3},
  AuthorizationStatus: {AUTHORIZED: 1},
  RepeatFrequency: {DAILY: 1, WEEKLY: 2},
  TriggerType: {TIMESTAMP: 0},
}));

jest.mock('react-native-in-app-review', () => ({
  isAvailable: jest.fn(() => false),
  RequestInAppReview: jest.fn(async () => false),
}));

jest.mock('@react-native-community/datetimepicker', () => 'DateTimePicker');

jest.mock('react-native-zip-archive', () => {
  return {
    unzip: jest.fn(async () => undefined),
  };
});

jest.mock('@react-native-community/netinfo', () => {
  return {
    __esModule: true,
    default: {
      fetch: jest.fn(async () => ({
        isConnected: true,
        isInternetReachable: true,
        type: 'wifi',
        details: null,
      })),
      addEventListener: jest.fn(() => jest.fn()),
    },
  };
});
