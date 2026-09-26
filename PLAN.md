# Duo demo plan

Deliver one complete flow: choose a voice, make a session, unfold into it, then close without losing progress.

## Current implementation

- Expo / React Native app with compact, closed, open landscape and open portrait layouts.
- Shared state and player ownership across changes in Duo geometry.
- Orb, voice selection, conversational onboarding, session preparation and playback.
- Bundled audio for a dependable demo path.
- Isolated native bundle ID and development server on port 8090.
- Browser pose controls that retain the same mounted app session.

## Finish in this order

1. Run the native build on the Duo simulator and check the complete onboarding-to-player flow.
2. Open and close during name entry and playback. Check that answers, selected voice, elapsed time and play/pause state survive. Repeat ten times, including rapid reversals.
3. Add and verify a native hinge-angle bridge if continuous unfolding motion is required. Current window-based layout changes do not prove hinge tracking or half-open behavior.
4. Confirm portrait, landscape, safe areas, text readability, Reduce Motion and the compact phone fallback.
5. Check microphone denial, offline fallback, background/foreground and completion. Verify the native live-service endpoint separately from the bundled demo.
6. Rehearse a short demo: closed orb, choose a voice, unfold, start playback, close while it continues.

The fold should change presentation, never request another session or restart audio. Keep one player owner across poses. Defer extra features until this sequence is dependable.

Simulator results establish software behavior. Check speaker/headphone output, haptics and physical fold feel on hardware when available.
