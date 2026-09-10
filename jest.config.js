module.exports = {
  preset: 'react-native',
  // react-native-worklets ships this resolver so its .native entry points
  // (which call into TurboModules) are not picked up under jest.
  resolver: '<rootDir>/node_modules/react-native-worklets/jest/resolver.js',
  transformIgnorePatterns: [
    // Every react-native-* package ships untranspiled ESM, so match the whole
    // family rather than listing them one by one as each new import surfaces.
    'node_modules/(?!(react-native|@react-native|@react-navigation|react-clone-referenced-element)[^/]*/)',
  ],
  setupFiles: [
    '<rootDir>/node_modules/react-native/jest/setup.js',
    '<rootDir>/node_modules/react-native-gesture-handler/jestSetup.js',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
};
