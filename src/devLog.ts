import { devServer } from './devServer';

// Tells the development server what just happened (app/api/log), so a failure on
// someone's phone can be read on the Mac afterwards. Only steps and numbers, never
// what they said. Fire and forget: logging never slows or breaks the app.
export function report(event: string, detail?: Record<string, unknown>) {
  const base = devServer();
  if (!base) return;
  void fetch(`${base}/api/log`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event, detail }) }).catch(() => {});
}
