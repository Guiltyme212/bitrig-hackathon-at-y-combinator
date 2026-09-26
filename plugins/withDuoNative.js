// iPhone Duo native build (KOKORO_DUO=1 only, see app.config.ts).
// 1. iOS 27 asserts at launch unless the app adopts the scene life cycle, so the window
//    moves to Expo's ExpoAppSceneDelegate and the AppDelegate only builds the RN factory.
// 2. Debug builds load JS from Metro on 8088 and never guess 8081, where the Expo Go demo
//    server runs (the prebuilt React core bakes 8081 in as its default port).
const { withAppDelegate, withInfoPlist } = require('expo/config-plugins');

const PORT = process.env.KOKORO_DUO_PORT || '8090';

function patchAppDelegate(src) {
  if (src.includes('ExpoReactNativeFactoryProvider')) return src;
  let out = src.replace('class AppDelegate: ExpoAppDelegate {', 'class AppDelegate: ExpoAppDelegate, ExpoReactNativeFactoryProvider {');
  // The scene delegate creates the window and starts React Native into it.
  out = out.replace(
    /#if os\(iOS\) \|\| os\(tvOS\)\n\s*window = UIWindow\(frame: UIScreen\.main\.bounds\)\n\s*factory\.startReactNative\(\n\s*withModuleName: "main",\n\s*in: window,\n\s*launchOptions: launchOptions\)\n#endif\n/,
    `#if DEBUG\n    RCTBundleURLProvider.sharedSettings().jsLocation = "localhost:${PORT}"\n#endif\n`,
  );
  out = out.replace(
    'return RCTBundleURLProvider.sharedSettings().jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry")',
    `return RCTBundleURLProvider.jsBundleURL(forBundleRoot: ".expo/.virtual-metro-entry", packagerHost: "localhost:${PORT}", enableDev: true, enableMinification: false, inlineSourceMap: false)`,
  );
  if (!out.includes('class SceneDelegate')) out += '\nclass SceneDelegate: ExpoAppSceneDelegate {}\n';
  if (out.includes('factory.startReactNative(') || !out.includes(`packagerHost: "localhost:${PORT}"`)) {
    throw new Error('withDuoNative: the AppDelegate template changed; patch it by hand.');
  }
  return out;
}

module.exports = config => {
  config = withAppDelegate(config, mod => {
    mod.modResults.contents = patchAppDelegate(mod.modResults.contents);
    return mod;
  });
  config = withInfoPlist(config, mod => {
    if (!mod.modResults.UIApplicationSceneManifest) {
      mod.modResults.UIApplicationSceneManifest = {
        UIApplicationSupportsMultipleScenes: false,
        UISceneConfigurations: {
          UIWindowSceneSessionRoleApplication: [
            { UISceneConfigurationName: 'Default Configuration', UISceneDelegateClassName: '$(PRODUCT_MODULE_NAME).SceneDelegate' },
          ],
        },
      };
    }
    // The inner display is regular width: rotate freely there, like the probe app.
    mod.modResults.UISupportedInterfaceOrientations = [
      'UIInterfaceOrientationPortrait', 'UIInterfaceOrientationPortraitUpsideDown',
      'UIInterfaceOrientationLandscapeLeft', 'UIInterfaceOrientationLandscapeRight',
    ];
    mod.modResults.UIRequiresFullScreen = false;
    return mod;
  });
  return config;
};
