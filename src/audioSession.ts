// Every player in the app keeps the phone's audio session alive when it pauses or
// finishes. By default expo-audio switches the session off a moment after any
// player stops, and it doesn't check for a recording: when Talk paused the music
// and stopped Kokoro's voice, that switch-off landed on the new recording, which
// then either heard silence or couldn't start (Dan, 26 September: "microphone
// doesn't work still").
export const KEEP_SESSION = { keepAudioSessionActive: true } as const;
