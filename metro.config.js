const path = require('path');
const {getDefaultConfig} = require('expo/metro-config');

// Enable to load the sibling SDK checkout instead of the installed package.
const useLocalStitchElement = false;

const projectRoot = __dirname;
const stitchElementPackageName = '@fastenhealth/fasten-stitch-element-react-native';
const stitchElementRoot = path.resolve(
  projectRoot,
  '../fasten-stitch-element-react-native',
);

const config = getDefaultConfig(projectRoot);

if (useLocalStitchElement) {
  config.watchFolders = [
    ...(config.watchFolders || []),
    stitchElementRoot,
  ];

  // Resolve peer dependencies from the app so Metro does not bundle a second React.
  config.resolver.disableHierarchicalLookup = true;
  config.resolver.nodeModulesPaths = [path.resolve(projectRoot, 'node_modules')];
  config.resolver.extraNodeModules = {
    ...(config.resolver.extraNodeModules || {}),
    [stitchElementPackageName]: stitchElementRoot,
  };
}

// Log SDK resolution, overriding the installed package only in local mode.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  const target = useLocalStitchElement && moduleName === stitchElementPackageName
    ? stitchElementRoot
    : moduleName;
  const result = context.resolveRequest(context, target, platform);

  if (moduleName === stitchElementPackageName && result.type === 'sourceFile') {
    console.log('[Stitch resolved]', result.filePath);
  }

  return result;
};

module.exports = config;
