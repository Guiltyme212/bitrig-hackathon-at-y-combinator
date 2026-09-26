import { router } from 'expo-router';
import { firstMeditation, kokoro, type KokoroState, type Plan } from './store';

// The meditation made in the latest conversation, as it's known in the library.
export const madeId = (s: KokoroState) => `m${s.makingStartedAt ?? 0}`;
export const isKept = (s: KokoroState) => s.sessions.some(session => session.id === madeId(s));

// The meditation made in a conversation lands at the top of the library, once.
export function keepMeditation() {
  const s = kokoro.get();
  if (isKept(s)) return;
  kokoro.set({ sessions: [{ ...firstMeditation(s), id: madeId(s) }, ...s.sessions] });
}

// The bookmark on the preview: keep it in the library, or let it go again.
export function toggleKept() {
  const s = kokoro.get();
  if (isKept(s)) kokoro.set({ sessions: s.sessions.filter(session => session.id !== madeId(s)) });
  else keepMeditation();
}

// Crossing the one-way door: onboarding, preview, paywall and sign-in leave the stack.
// Today greets them once with where their first meditation went.
export function finishFirstRun(plan: Plan) {
  keepMeditation();
  kokoro.set({ plan, onboarded: true, arrived: true });
  setTimeout(() => router.replace('/today'), 0);
}
