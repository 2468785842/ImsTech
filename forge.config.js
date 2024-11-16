import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';

export default {
  packagerConfig: {
    asar: true,
    derefSymlinks: true,
    icon: './assets/The_Open_University_of_China_logo.ico',
    ignore: [
      /test/, // 忽略测试文件夹
      /\.git/, // 忽略 .git 文件夹
      /\.env/, // 忽略 .env 文件
    ],
  },
  makers: [
    // {
    //   name: '@electron-forge/maker-wix',
    //   config: {
    //     name: 'ims-tech-auto',
    //     manufacturer: 'Github',
    //     language: 2052,
    //     icon: './assets/The_Open_University_of_China_logo.ico',
    //   },
    // },
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: 'ImsTechAuto',
        authors: 'LiDong',
        shortName: 'ImsTechAuto',
      },
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
