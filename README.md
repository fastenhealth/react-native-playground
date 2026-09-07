
# Fasten Connect React Native SDK (Beta)

This project uses the Fasten Stitch Element React Native SDK for integrating Fasten Connect into your application. **Please note that this SDK is currently in beta and may not reflect the final version.**

## Prerequisites

Before setting up the project, ensure you have the following installed:

- **Node.js** (v20.19.4 or later; Node 22 LTS recommended)
- **Yarn Classic** (1.22.22)
- **Xcode 26.2 or later** for iOS
- A working React Native environment (iOS/Android)

## Setup Instructions

1. **Clone the repository**:
   ```bash
   git clone <repository-url>
   cd <repository-folder>
   ```

2. **Install dependencies**:
   Use `yarn` to install the required dependencies:
   ```bash
   yarn install
   ```

3. **Configure the SDK**:
    - Replace `CUSTOMER_PUBLIC_ID` in the `App.ts` file with your actual public ID provided by Fasten Connect.

4. **Run the application**:
    ```
   npx expo start
   ```

## Notes

- This app pins Expo `55.0.31` with React Native `0.83.10` and React `19.2.0` to stay compatible with Xcode 26.3. Expo SDK 56 and 57 require Xcode 26.4 or later; see the [Expo compatibility table](https://docs.expo.dev/versions/latest/#support-for-android-and-ios-versions). Keep Expo packages aligned with SDK 55 using `npx expo install --check`.
- This SDK uses `WebView` to embed Fasten Connect functionality. Ensure your app has the necessary permissions and configurations for `WebView` to work correctly.
- Debugging is enabled by default in this beta version. Make sure to disable it in production by setting `webviewDebuggingEnabled` to `false`.

## Known Issues

- The SDK is in beta, and some features may not work as expected.
- Documentation and API stability are subject to change in future releases.

## Feedback

We welcome your feedback! Please report any issues or suggestions via the issue tracker in this repository.

---

**Disclaimer**: This SDK is provided as-is during the beta phase. Use it at your own risk in production environments.
```
