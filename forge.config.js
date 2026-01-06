module.exports = {
  packagerConfig: {
    name: "WinMD Explorer",
    icon: "./icon" // Looks for icon.ico on Windows
  },
  rebuildConfig: {},
  makers: [
    {
      name: '@electron-forge/maker-squirrel',
      config: {
        name: "winmd_explorer",
        authors: "WinMD",
        description: "Markdown Explorer"
      },
    },
    {
      name: '@electron-forge/maker-zip',
      platforms: ['darwin', 'linux', 'win32'],
    },
  ],
};