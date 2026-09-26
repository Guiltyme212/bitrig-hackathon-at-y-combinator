import { devServer } from '../devServer';
import type { Brief, MadeSession, MakingStatus, NarratorId } from './types';

// The app's side of the meditation engine (app/api/meditation). Every call fails
// soft: null or false means "make it the local way instead".

async function call<T>(path: string, init?: RequestInit): Promise<T | null> {
  const base = devServer();
  if (!base) return null;
  try {
    const response = await fetch(`${base}${path}`, { ...init, headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) } });
    if (!response.ok) { if (__DEV__) console.warn(`Meditation engine: ${path} → ${response.status}`); return null; }
    return await response.json() as T;
  } catch (error) {
    if (__DEV__) console.warn('Meditation engine unreachable', error);
    return null;
  }
}

export const canMake = () => devServer() !== null;

export async function startMaking(brief: Brief): Promise<string | null> {
  const result = await call<{ id: string }>('/api/meditation', { method: 'POST', body: JSON.stringify({ brief }) });
  return result?.id ?? null;
}

export async function chooseVoice(id: string, voiceId: NarratorId): Promise<boolean> {
  const result = await call<{ ok: boolean }>('/api/meditation', { method: 'POST', body: JSON.stringify({ id, voiceId }) });
  return !!result?.ok;
}

export const makingStatus = (id: string) => call<MakingStatus>(`/api/meditation?id=${encodeURIComponent(id)}`);
export const goldenSession = async (voiceId: NarratorId) => (await call<MakingStatus>(`/api/meditation?golden=1&voice=${voiceId}`))?.session ?? null;

// Where the player streams a finished narration (and a long bed) from.
export function narrationUri(session: MadeSession): string | null {
  const base = devServer();
  return base ? `${base}${session.voicePath}` : null;
}
export function bedUri(session: MadeSession): string | null {
  const base = devServer();
  return base && session.musicPath ? `${base}${session.musicPath}` : null;
}

// Follows a meditation until it's ready or failed (or `timeout` passes), telling
// `onStatus` about every change. Returns a function that stops following.
export function followMaking(id: string, onStatus: (status: MakingStatus) => void, timeout = 150_000): () => void {
  let stopped = false, last = '';
  const started = Date.now();
  const tick = async () => {
    if (stopped) return;
    const status = await makingStatus(id);
    if (stopped) return;
    if (status) {
      const key = `${status.stage}:${status.done ?? ''}`;
      if (key !== last) { last = key; onStatus(status); }
      if (status.stage === 'ready' || status.stage === 'failed') return;
    }
    if (Date.now() - started > timeout) { onStatus({ id, stage: 'failed', error: 'It took too long.' }); return; }
    setTimeout(tick, 900);
  };
  void tick();
  return () => { stopped = true; };
}
