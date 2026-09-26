# Kokoro for iPhone Duo

Ship one complete, dependable experience: choose a session, unfold into it, listen, and fold back without losing your place.

## 1. Prove the device interaction

- Run a minimal app in the Duo simulator. Confirm outer and inner display layouts, live hinge updates, and reserved regions for the fold and camera.
- Test opening, closing, reversing halfway, and rotating. Keep session state outside the views that change with the device pose.
- Choose the runtime after this check. SwiftUI is the leading option for direct Duo API access. A React Native route needs a native build that proves hinge access and full display support; Expo Go alone is not enough evidence.

Done when the same session identifier and playback position survive repeated fold changes. Do this before building more screens.

## 2. Build the unfolding moment

Proposed direction for review:

- Closed: an orb and one clear action to enter a session.
- Opening: the orb expands with the hinge into the inner display. Reversing the fold reverses the transition without a jump.
- Open: a quiet session view with reachable playback controls. Keep text and buttons clear of the fold and camera.
- Half-open: support a hands-free pose if it fits the demo time. Keep the orb above and controls below.
- Closing: return to the compact view with playback and progress intact.

Opening the device must not restart playback, generate another session, or request microphone access. Respect Reduce Motion. A phone without a hinge gets a complete compact flow.

## 3. Complete one session

- Choose a session, start it, pause and resume, and reach completion.
- Use one player owner across display changes. Fold events affect presentation, not audio lifetime.
- Show clear loading and error states. Prevent duplicate requests from repeated taps.
- Provide a bundled demo session so the core demonstration works without a network connection. Identify it as a demo if live generation is unavailable.
- Keep provider credentials on the server and out of the app bundle.

## 4. Rehearse the demo

- Launch from a stopped app on Duo and a normal iPhone.
- Finish the compact flow without layout clipping or blocked controls.
- Repeat open/close ten times during playback, including a reversal halfway through.
- Check portrait, landscape, half-open, background/foreground, pause/resume, and completion.
- Check microphone denial and loss of network without a crash or a dead end.
- Record a short demo showing the actual fold interaction and continuous playback.

Simulator checks prove software behavior. Physical-device audio and haptics need a separate check when hardware is available.

## Keep the scope small

First demo: one compact flow, one unfolding transition, one working session, and a reliable fallback. Defer accounts, subscriptions, a large library, and extra onboarding screens.

Use feature branches. Keep `main` runnable once the app is added, and merge only after checking both compact and Duo layouts.

## References

- [Bitrig's Duo support and native APIs](https://bitrig.com/blog/bitrig-builds-iphone-duo-apps)
- [Bitrig Hacks: iPhone Duo Edition](https://luma.com/yc-meetup-4378)
