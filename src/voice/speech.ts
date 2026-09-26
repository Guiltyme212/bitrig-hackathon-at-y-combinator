import { Platform } from 'react-native';
import { createAudioPlayer } from 'expo-audio';
import { KEEP_SESSION } from '../audioSession';
import { report } from '../devLog';

// Kokoro's voice and ears live on the development server that serves this
// prototype (app/api/speak, app/api/listen), so no key ever reaches the app.
// Without that server (a production build, offline, web export) Kokoro simply
// types in silence and asks to be typed to.
function origin(): string | null {
  if (!__DEV__) return null;
  const location = (globalThis as { location?: { origin?: string } }).location;
  const value = location?.origin;
  return value && value !== 'null' ? value.replace(/\/$/, '') : null;
}

export type Speech = {
  duration: number;              // ms
  play: () => Promise<void>;     // resolves when the line has been spoken (or stopped)
  stop: () => void;
};

// Lines Kokoro is about to say, loaded ahead (its first words load while the welcome
// is on screen), so the voice can start the moment the orb lands. Each is used once.
// Kokoro speaks in the voice chosen at the start (a narrator id; Brittney before that).
const ahead = new Map<string, Promise<Speech | null>>();
export function prefetchSpeech(lines: readonly string[], voice = 'brittney') {
  if (!origin()) return;
  for (const text of lines) { const key = `${voice}|${text}`; if (!ahead.has(key)) ahead.set(key, load(text, 15000, voice)); }
}
// Has the server make these lines ready in a voice (cached there), without loading them here.
export function warmSpeech(lines: readonly string[], voice = 'brittney') {
  const base = origin();
  if (!base) return;
  for (const text of lines) void fetch(`${base}/api/speak?text=${encodeURIComponent(text)}&voice=${voice}`).catch(() => {});
}

// One line of Kokoro's speech, ready to play: resolves with its length, or with null
// when there's no voice to be had in time. A line loaded ahead is used if it arrives
// within the usual wait; otherwise Kokoro types in silence and the late voice is dropped.
export function prepareSpeech(text: string, timeout = 3000, voice = 'brittney'): Promise<Speech | null> {
  const key = `${voice}|${text}`;
  const early = ahead.get(key);
  if (!early) return load(text, timeout, voice);
  ahead.delete(key);
  return new Promise(resolve => {
    let done = false;
    const timer = setTimeout(() => { done = true; resolve(null); }, timeout);
    void early.then(speech => {
      if (done) { speech?.stop(); return; }
      done = true;
      clearTimeout(timer);
      resolve(speech);
    });
  });
}

function load(text: string, timeout: number, voice = 'brittney'): Promise<Speech | null> {
  const base = origin();
  if (!base) return Promise.resolve(null);
  return new Promise(resolve => {
    let settled = false, released = false, ended: (() => void) | null = null;
    const player = createAudioPlayer({ uri: `${base}/api/speak?text=${encodeURIComponent(text)}&voice=${voice}` }, { updateInterval: 100, downloadFirst: true, ...KEEP_SESSION });
    const release = () => {
      if (released) return;
      released = true;
      sub.remove();
      try { player.pause(); player.remove(); } catch {}
      ended?.(); ended = null;
    };
    const timer = setTimeout(() => { if (!settled) { settled = true; release(); resolve(null); } }, timeout);
    const sub = player.addListener('playbackStatusUpdate', status => {
      if (!settled && status.isLoaded && status.duration > 0) {
        settled = true;
        clearTimeout(timer);
        resolve({
          duration: status.duration * 1000,
          play: () => new Promise<void>(done => { ended = done; try { player.play(); } catch { release(); } }),
          stop: release,
        });
      }
      if (status.didJustFinish) release();
    });
  });
}

// Sends what someone said to be written down. Returns the words, '' for silence,
// or null when it couldn't be heard.
export async function transcribe(uri: string): Promise<string | null> {
  const base = origin();
  if (!base) return null;
  const body = new FormData();
  body.append('audio', { uri, name: 'speech.m4a', type: 'audio/m4a' } as unknown as Blob);
  const read = (status: number, text: string) => {
    report('transcribe:done', { status, bytes: text.length });
    if (status < 200 || status >= 300) { if (__DEV__) console.warn(`Listening: the server said ${status}`); return null; }
    try { return ((JSON.parse(text) as { text?: string }).text ?? '').trim(); } catch { return null; }
  };
  // On iOS and Android the recording is a file on the phone. Expo's fetch rejects a
  // { uri } form part ("Unsupported FormDataPart"), so it goes up through React
  // Native's XMLHttpRequest, which sends the file itself.
  if (Platform.OS !== 'web') {
    return new Promise(resolve => {
      const request = new XMLHttpRequest();
      request.open('POST', `${base}/api/listen`);
      request.timeout = 40_000;
      request.onload = () => resolve(read(request.status, request.responseText));
      request.onerror = () => { report('transcribe:failed', { why: 'network' }); if (__DEV__) console.warn('Listening: could not reach the server'); resolve(null); };
      request.ontimeout = () => { report('transcribe:failed', { why: 'timeout' }); if (__DEV__) console.warn('Listening: the server took too long'); resolve(null); };
      request.send(body);
    });
  }
  try {
    const response = await fetch(`${base}/api/listen`, { method: 'POST', body });
    return read(response.status, await response.text());
  } catch (error) { if (__DEV__) console.warn('Listening: could not reach the server', error); return null; }
}

export const canTalk = () => origin() !== null;
