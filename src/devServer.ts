// The development server that serves this prototype also hosts Kokoro's live
// services (app/api/*), so no key ever reaches the app. In a production build,
// offline or in a web export there is none, and the app falls back to its
// authored local behaviour.
let offlinePreview = false;
export function devServer(): string | null {
  if (!__DEV__) return null;
  // Explicit browser QA mode exercises the bundled flow without buying generations.
  if (typeof window !== 'undefined' && window.location?.search &&
      new URLSearchParams(window.location.search).get('offline') === '1') offlinePreview = true;
  // Router navigation drops query parameters; QA stays offline for this page lifetime.
  if (offlinePreview) return null;
  const location = (globalThis as { location?: { origin?: string } }).location;
  const value = location?.origin;
  return value && value !== 'null' ? value.replace(/\/$/, '') : null;
}
