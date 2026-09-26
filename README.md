# Kokoro for iPhone Duo

A meditation app built around the unfolding moment, for the Bitrig hackathon at Y Combinator.

Choose a voice, describe what you need, and enter a session. Unfolding gives the orb and conversation their own space. Closing returns to a compact layout while keeping the current flow mounted.

## Run

```sh
npm ci
npm run preview
```

Open [the Duo preview](http://localhost:8090/duo-preview.html). Its pose controls exercise the actual app at closed, open, portrait and normal-phone sizes without resetting the session. The preview uses bundled audio and disables live generation. The app uses Expo 57 and React Native 0.86.

## Check

```sh
npm run check
npm run export:web
npm run export:ios
```

Native Duo builds use `KOKORO_DUO=1 KOKORO_DUO_PORT=8090` and bundle ID `com.kokoro.hackathon.duo`. The config plugin enables scene lifecycle support, rotation and a black launch background. Generate the native project with `KOKORO_DUO=1 KOKORO_DUO_PORT=8090 npx expo prebuild --platform ios` before building with Xcode.

Local provider credentials belong in ignored `.env.local`; RevenueCat public SDK configuration belongs in ignored `.revenuecat.local.json` using the example file. Live services are development-only. Native demo playback works with bundled audio; a native live-service endpoint still needs configuration and verification.

Layout currently follows window geometry and safe-area insets. A continuous hinge-angle bridge is still to be implemented. Browser pose checks do not prove the physical fold transition, audio output or haptics.

See [PLAN.md](PLAN.md) for the remaining demo checks.
