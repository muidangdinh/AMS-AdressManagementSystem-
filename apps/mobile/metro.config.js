const path = require('path');
const { getDefaultConfig, mergeConfig } = require('@react-native/metro-config');

const projectRoot = __dirname;
// Gốc monorepo (../../ từ apps/mobile) — cần để Metro thấy được node_modules
// hoisted ở root và package @tayninh/shared trong packages/shared.
const workspaceRoot = path.resolve(projectRoot, '../..');

/**
 * Metro configuration cho monorepo (npm workspaces).
 * https://reactnative.dev/docs/metro
 *
 * @type {import('@react-native/metro-config').MetroConfig}
 */
const config = {
  // Theo dõi thay đổi file cả trong monorepo root (vd packages/shared)
  watchFolders: [workspaceRoot],
  resolver: {
    // Cho phép resolve node_modules từ cả app lẫn root (hoisted deps)
    nodeModulesPaths: [
      path.resolve(projectRoot, 'node_modules'),
      path.resolve(workspaceRoot, 'node_modules'),
    ],
    // @tayninh/shared là package TS nguồn chưa build — Metro cần biết coi
    // .ts/.tsx trong đó là source, không phải qua "main" đã compile.
    unstable_enablePackageExports: true,
  },
};

module.exports = mergeConfig(getDefaultConfig(projectRoot), config);
