const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

// Monorepo: la Metro overvåke hele repoet (additivt — behold Expos defaults)
config.watchFolders = [...(config.watchFolders ?? []), monorepoRoot];

// Monorepo: løs node_modules fra både prosjektrot og monorepo-rot
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(monorepoRoot, "node_modules"),
];

module.exports = withNativeWind(config, {
  input: "./src/global.css",
});
