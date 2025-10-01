# Shakespeare 🎭

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https://gitlab.com/soapbox-pub/shakespeare.git)

AI-powered Nostr website builder. Describe what you want to build, and AI helps you create it.

https://shakespeare.diy

## Features

- **AI Chat**: Build websites through natural conversation
- **File Attachments**: Drag & drop files or paste images
- **Live Preview**: See changes in real-time
- **Code Editor**: Edit files with syntax highlighting
- **Git Integration**: Full version control with credential management
- **Nostr Ready**: Built-in Nostr protocol support

## Quick Start

1. **Describe** your project in the textarea
2. **Chat** with AI to build features
3. **Preview** your website instantly
4. **Deploy** with one click

## Tech Stack

- React 18 + TypeScript
- Vite + TailwindCSS
- shadcn/ui + Nostrify
- LightningFS + isomorphic-git

## Getting Started

Visit the homepage, enter your project idea, and start building with AI assistance.

## Mobile Development

Shakespeare supports building native Android apps using Capacitor.js. The mobile app provides the full Shakespeare experience with native mobile optimizations.

### Android Development

#### Prerequisites

- [Android Studio](https://developer.android.com/studio) installed
- Android SDK and build tools
- Java Development Kit (JDK) 17 or higher

#### Building for Android

1. **Build the web app:**
   ```bash
   npm run build
   ```

2. **Sync web assets to Android:**
   ```bash
   npm run android:sync
   ```

3. **Open in Android Studio:**
   ```bash
   npm run android:open
   ```

4. **Build APK directly (optional):**
   ```bash
   npm run android:build
   ```

5. **Run on device/emulator:**
   ```bash
   npm run android:run
   ```

#### Available Scripts

- `android:build` - Build web app and create Android APK
- `android:open` - Open the Android project in Android Studio
- `android:sync` - Sync web assets to Android project
- `android:run` - Build, sync, and run on connected device/emulator

#### Mobile Features

- **Native status bar integration** with theme-aware styling
- **Splash screen** with Shakespeare branding
- **Keyboard handling** for better mobile UX
- **Hardware back button** support on Android
- **Safe area support** for modern devices with notches
- **Touch-optimized** UI elements (44px minimum touch targets)
- **Responsive design** that adapts to mobile screens

#### Customization

The mobile app can be customized by editing:
- `capacitor.config.ts` - Capacitor configuration
- `android/app/src/main/res/` - Android resources (icons, splash screens)
- `src/capacitor.ts` - Mobile-specific initialization code

## License

AGPLv3