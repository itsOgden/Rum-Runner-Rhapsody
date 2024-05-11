const { FusesPlugin } = require('@electron-forge/plugin-fuses');
const { FuseV1Options, FuseVersion } = require('@electron/fuses');

// TODO: App Icons
// https://www.electronforge.io/guides/create-and-add-icons
// TODO: Code Signing
// https://www.electronforge.io/guides/code-signing
// https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging
// TODO: Auto Updates
// https://www.electronforge.io/advanced/auto-update
// https://www.electronjs.org/docs/latest/tutorial/tutorial-publishing-updating
module.exports = {
  packagerConfig: {
    asar: true,
  },
  rebuildConfig: {},
  // Other maker options:
  // https://www.electronforge.io/config/makers
  makers: [
    {
      // TODO: Maybe handle startup events while installing?
      // https://www.electronforge.io/config/makers/squirrel.windows#handling-startup-events
      name: '@electron-forge/maker-squirrel',
      config: {
        // certificateFile: './cert.pfx',
        // certificatePassword: process.env.CERTIFICATE_PASSWORD
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin'],
    },
  ],
  plugins: [
    {
      name: '@electron-forge/plugin-auto-unpack-natives',
      config: {},
    },
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};
