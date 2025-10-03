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