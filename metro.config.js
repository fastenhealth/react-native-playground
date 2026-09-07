const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

const projectRoot = __dirname;
const stitchElementRoot = path.resolve(
  projectRoot,
  '../fasten-stitch-element-react-native',
);

const config = getDefaultConfig(projectRoot);

config.watchFolders = [
  ...(config.watchFolders || []),
  stitchElementRoot,
];

// Resolve peer dependencies from the app so Metro does not bundle a second React.
config.resolver.disableHierarchicalLookup = true;
config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
config.resolver.extraNodeModules = {
  ...(config.resolver.extraNodeModules || {}),
  '@fastenhealth/fasten-stitch-element-react-native': stitchElementRoot,
};

module.exports = config;
