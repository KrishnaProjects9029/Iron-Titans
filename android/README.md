# Iron Titans 3D — Android Release Packaging

This directory contains the complete native Android packaging wrapper for **Iron Titans 3D (v1.0.0)**.

## Architecture Highlights
- **Engine**: Three.js WebGL 2.0 with Hardware Acceleration enabled.
- **Orientation**: Immersive Sticky Landscape (`sensorLandscape`).
- **Asset Loading**: `WebViewAssetLoader` maps local `assets/` securely to `https://appassets.androidplatform.net/assets/`, ensuring safe origin access to `localStorage` and high-performance offline execution.
- **Hardware Back Button**: Forwards back key events directly to the in-game UI router to prompt combat abandon confirmation or navigate back to the main menu.
- **Audio & Haptics**: Full Web Audio and device vibration integration.

## Build Steps
1. Bundle web assets to Android assets folder:
   ```bash
   node scratch/bundle_android_assets.js
   ```
2. Build Debug or Release APK using Gradle:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
   Or open the `android` directory in **Android Studio** and click **Build > Generate Signed Bundle / APK**.
