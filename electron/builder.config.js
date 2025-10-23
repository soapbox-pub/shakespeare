export default {
  appId: 'pub.soapbox.shakespeare',
  productName: 'Shakespeare',

  directories: {
    output: 'electron-dist',
    buildResources: 'electron/resources',
  },

  files: [
    'dist/**/*',
    'electron/main.js',
    'electron/preload.js',
    'public/shakespeare-512x512.png',
    'public/shakespeare.svg',
  ],

  extraMetadata: {
    main: 'electron/main.js',
  },

  // macOS configuration
  mac: {
    category: 'public.app-category.developer-tools',
    icon: 'public/shakespeare-512x512.png', // Will be converted automatically
    target: [
      {
        target: 'dmg',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'zip',
        arch: ['x64', 'arm64'],
      },
    ],
    darkModeSupport: true,
  },

  dmg: {
    contents: [
      {
        x: 130,
        y: 220,
      },
      {
        x: 410,
        y: 220,
        type: 'link',
        path: '/Applications',
      },
    ],
    window: {
      width: 540,
      height: 380,
    },
  },

  // Windows configuration
  win: {
    icon: 'public/shakespeare-512x512.png', // Will be converted automatically
    target: [
      {
        target: 'nsis',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'portable',
        arch: ['x64', 'arm64'],
      },
    ],
  },

  nsis: {
    oneClick: false,
    allowToChangeInstallationDirectory: true,
    createDesktopShortcut: true,
    createStartMenuShortcut: true,
  },

  // Linux configuration
  linux: {
    icon: 'public/shakespeare-512x512.png',
    category: 'Development',
    target: [
      {
        target: 'AppImage',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'deb',
        arch: ['x64', 'arm64'],
      },
      {
        target: 'rpm',
        arch: ['x64', 'arm64'],
      },
    ],
  },

  appImage: {
    license: 'LICENSE',
  },

  // Publish configuration (optional - for auto-updates)
  publish: null,
};
