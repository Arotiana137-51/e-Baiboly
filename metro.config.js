const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const defaultConfig = getDefaultConfig(__dirname);

/**
 * Metro configuration
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  resolver: {
    // Native build output: CMake (.cxx) and Gradle (build) create and delete
    // folders there while a build runs, and Metro's file watcher (no Watchman
    // on Windows) crashes on a folder that vanishes mid-scan. No JS lives there.
    blockList: [
      defaultConfig.resolver.blockList,
      /[\\/]\.cxx([\\/].*)?$/,
      /[\\/]android[\\/](.*[\\/])?build([\\/].*)?$/,
    ],
  },
};

module.exports = mergeConfig(defaultConfig, config);
