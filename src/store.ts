import { useSyncExternalStore } from 'react';
import type { FeelingId } from './stage/script';
import type { VoiceId } from './voices/voices';
import type { Brief, MadeSession, Outcome } from './meditation/types';

// Front-end prototype state. Nothing persists: reloading the app starts the
// first-run flow again. Meditations are made by the development server's engine
// (src/meditation/api.ts) and kept here, by id, for the player and the library.
export type Session = { id: string; title: string; minutes: number; sound: string; when: string; kind: 'sleep' | 'calm' | 'focus' | 'reset'; description?: string; voiceId?: VoiceId; narrationId?: string };
// The meditation the conversation asked for. `brief` comes from Kokoro's brain
// when it could be reached; `makingId` is the engine's job; `narrationId` the finished
// narration in `made`.
export type Meditation = {
  title: string; description: string; minutes: number; voiceId: VoiceId; feel: FeelingId | null; mind: string; kind: string;
  outcome?: Outcome; brief?: Brief; makingId?: string; narrationId?: string;
};
export type Plan = 'none' | 'trial' | 'free' | 'pro';
export type SleepTimer = 'off' | '10' | '20' | 'end';

export type KokoroState = {
  name: string;
  sound: string;
  future: string;
  cost: string;
  frequency: string;
  burdens: string[];
  onboarded: boolean;
  plan: Plan;
  billing: 'yearly' | 'monthly';
  sessions: Session[];
  played: string[];
  voice: number;
  music: number;
  binaural: boolean;
  timer: SleepTimer;
  mood: string | null;
  makingStartedAt: number | null;
  voiceId: VoiceId;
  meditation: Meditation | null;
  soundOn: boolean;
  arrived: boolean;          // just crossed into the app; Today says where the library is
  made: Record<string, MadeSession>;
};

// The making steps, in order. In this preview each takes ~2.6s; the real
// generation (script, Suno music, voice) takes about four minutes.
export const makingSteps = (sound: string) => ['Listening to what you shared', 'Writing your script', sound === 'Just my voice' || !sound ? 'Shaping the pauses' : `Composing ${sound.toLowerCase()}`, 'Recording the voice'];
export function makingStage(startedAt: number | null, now = Date.now()) {
  if (startedAt === null) return 0;
  return Math.min(4, 1 + Math.floor((now - startedAt) / 2600));
}

const initial: KokoroState = {
  name: '', sound: '', future: '', cost: '', frequency: '', burdens: [],
  onboarded: false, plan: 'none', billing: 'yearly',
  sessions: [], played: [],
  voice: 100, music: 100, binaural: false, timer: 'end', mood: null,
  makingStartedAt: null,
  voiceId: 'natasha', meditation: null, soundOn: true, arrived: false,
  made: {},
};

let state = initial;
const listeners = new Set<() => void>();

export const kokoro = {
  get: () => state,
  set(patch: Partial<KokoroState>) {
    state = { ...state, ...patch };
    listeners.forEach(listener => listener());
  },
  reset() {
    state = initial;
    listeners.forEach(listener => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => { listeners.delete(listener); };
  },
};

// Selectors must return primitives or references held in state, never fresh objects.
export function useKokoro<T>(select: (s: KokoroState) => T): T {
  return useSyncExternalStore(kokoro.subscribe, () => select(state), () => select(state));
}

export function firstMeditation(s: KokoroState): Session {
  const m = s.meditation;
  if (m) return { id: 'tonight', title: m.title, description: m.description, minutes: m.minutes, sound: s.sound || 'Made for you', voiceId: m.voiceId, when: 'Tonight', narrationId: m.narrationId,
    kind: m.feel === 'sleep' || m.outcome === 'sleep' ? 'sleep' : m.feel === 'motivated' || m.feel === 'confident' || m.outcome === 'clarity' ? 'focus' : 'calm' };
  return { id: 'tonight', title: 'Letting the day go', minutes: 3, sound: s.sound || 'Made for you', voiceId: s.voiceId, when: 'Tonight', kind: 'sleep' };
}

export function partOfDay(date = new Date()) {
  const h = date.getHours();
  return h < 5 ? 'night' : h < 12 ? 'morning' : h < 18 ? 'afternoon' : 'evening';
}

export const todayKey = (d = new Date()) => `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
