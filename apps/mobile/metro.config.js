/** @type {import('expo/metro-config').MetroConfig} */
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// pnpm workspace: the root package.json has no "workspaces" field, so Expo's
// automatic watch-folder detection returns []. Watch the monorepo root
// explicitly so Metro can resolve symlinked packages in the pnpm store.
config.watchFolders = [workspaceRoot];

module.exports = withNativeWind(config, { input: "./global.css" });
