// The iPhone Duo, as a layout. Everything here is pure (no React) so it can be tested.
//
// Measured on the Xcode 27.1 simulator with a 27.1-SDK probe app, in points:
//   closed (outer display)   466 x 678, a system strip 84 wide down the right edge
//                            (camera and status in its top 170): content column 382 wide.
//   open, landscape          951 x 669, the same 84 strip on the right (status in its top 120);
//                            the fold is a 40 pt band at x 455.5–495.5 (UIKit's division region,
//                            its 20 pt margins included), active only when half-open.
//   open, portrait           669 x 951, bars across the top (82) and the fold at y 455.5–495.5.
// Anything else is a phone and must lay out exactly as it always has.

export type Geometry = 'phone' | 'closed' | 'closedLandscape' | 'openLandscape' | 'openPortrait';
export type Rect = { x: number; y: number; w: number; h: number };
export type Insets = { top: number; right: number; bottom: number; left: number };
export type Fold = { axis: 'x' | 'y'; band: [number, number] };
export type DuoLayout = {
  geometry: Geometry;
  duo: boolean;
  window: { w: number; h: number };
  insets: Insets;            // what the system reports
  content: Rect;             // window minus the insets
  fold: Fold | null;
  // Open poses: the orb's page (the room) and the words page (the thread, beside the system
  // strip, physically where the outer display sits once the Duo is closed).
  pages: { orb: Rect; words: Rect } | null;
  // Where a phone-shaped screen goes: the whole window on a phone, the content column when
  // closed, the words page when open. `insets` are the ones that screen should see.
  column: { rect: Rect; insets: Insets };
  key: string;
};

export const FOLD_HALF = 20;          // half the 40 pt division band
const STRIP_MIN = 60;                 // a side inset this wide is the Duo's system strip
const COLUMN_TOP = 18;                // no status bar above the column on the Duo
const PAGE_EDGE = 24;                 // inner margin of a page, both sides of the fold

const zero: Insets = { top: 0, right: 0, bottom: 0, left: 0 };

export function duoLayout(window: { w: number; h: number }, insets: Insets, forced?: Geometry | null): DuoLayout {
  const { w, h } = window;
  const geometry = forced ?? classify(w, h, insets);
  const content: Rect = { x: insets.left, y: insets.top, w: w - insets.left - insets.right, h: h - insets.top - insets.bottom };
  const base = { geometry, duo: geometry !== 'phone', window, insets, content, key: `${geometry}:${Math.round(w)}x${Math.round(h)}` };

  if (geometry === 'phone') {
    return { ...base, fold: null, pages: null, column: { rect: { x: 0, y: 0, w, h }, insets } };
  }
  const bottom = Math.max(insets.bottom, 16);
  if (geometry === 'closed' || geometry === 'closedLandscape') {
    // The strip is app background below its status block, but it is the system's side:
    // content keeps to the column and only backgrounds (the welcome glass) run under it.
    return {
      ...base, fold: null, pages: null,
      column: { rect: content, insets: { top: Math.max(insets.top, COLUMN_TOP), right: 0, bottom, left: 0 } },
    };
  }
  if (geometry === 'openLandscape') {
    const mid = w / 2;
    const band: [number, number] = [mid - FOLD_HALF, mid + FOLD_HALF];
    // Pages sit either side of the band; the words page is the one beside the strip.
    const stripRight = insets.right >= insets.left;
    const left: Rect = { x: insets.left, y: 0, w: band[0] - insets.left, h };
    const right: Rect = { x: band[1], y: 0, w: w - insets.right - band[1], h };
    const pages = stripRight ? { orb: left, words: right } : { orb: right, words: left };
    return {
      ...base, fold: { axis: 'x', band }, pages,
      column: { rect: pages.words, insets: { top: Math.max(insets.top, COLUMN_TOP), right: 0, bottom, left: 0 } },
    };
  }
  // openPortrait: the top half is for looking, the bottom half (flat on a table) for touching.
  const mid = h / 2;
  const band: [number, number] = [mid - FOLD_HALF, mid + FOLD_HALF];
  const top: Rect = { x: insets.left, y: insets.top, w: w - insets.left - insets.right, h: band[0] - insets.top };
  const bottomPage: Rect = { x: insets.left, y: band[1], w: w - insets.left - insets.right, h: h - insets.bottom - band[1] };
  const upsideDown = insets.bottom > insets.top;
  const pages = upsideDown ? { orb: bottomPage, words: top } : { orb: top, words: bottomPage };
  return {
    ...base, fold: { axis: 'y', band }, pages,
    column: { rect: pages.words, insets: { top: 12, right: 0, bottom: upsideDown ? 12 : bottom, left: 0 } },
  };
}

function classify(w: number, h: number, i: Insets): Geometry {
  const strip = Math.max(i.left, i.right) >= STRIP_MIN;
  // Open landscape and portrait are sizes no phone has (wider than 900 and shorter than
  // 720, or 600–720 wide and taller than 900); the closed display is told by its strip.
  if (w >= 900 && h >= 600 && h < 720 && strip) return 'openLandscape';
  if (h >= 900 && w >= 600 && w < 720) return 'openPortrait';
  if (strip && w < 600 && h < 720 && h > w) return 'closed';
  // An ordinary iPhone in landscape also has side insets (about 62), so a sideways closed
  // Duo is only recognised by its size: 678 x 466.
  if (strip && Math.round(w) === 678 && Math.round(h) === 466) return 'closedLandscape';
  return 'phone';
}

// The page edges used for text, clear of the fold band by PAGE_EDGE on the fold side.
export function pageInner(r: Rect, fold: Fold | null): Rect {
  if (!fold) return r;
  if (fold.axis === 'x') return { x: r.x + PAGE_EDGE, y: r.y, w: r.w - PAGE_EDGE * 2, h: r.h };
  return { x: r.x, y: r.y + PAGE_EDGE, w: r.w, h: r.h - PAGE_EDGE * 2 };
}

export function hitsFold(r: Rect, fold: Fold | null) {
  if (!fold) return false;
  const [a, b] = fold.band;
  return fold.axis === 'x' ? r.x < b && r.x + r.w > a : r.y < b && r.y + r.h > a;
}

// Dev sandbox (web): ?duo=closed|openLandscape|openPortrait fakes the Duo's window and insets.
export const SANDBOX: Record<string, { w: number; h: number; insets: Insets }> = {
  closed: { w: 466, h: 678, insets: { top: 0, right: 84, bottom: 20, left: 0 } },
  closedLandscape: { w: 678, h: 466, insets: { top: 0, right: 84, bottom: 20, left: 0 } },
  openLandscape: { w: 951, h: 669, insets: { top: 0, right: 84, bottom: 20, left: 0 } },
  openPortrait: { w: 669, h: 951, insets: { top: 82, right: 0, bottom: 20, left: 0 } },
};
export { zero as NO_INSETS };

// The orb's home on the orb page (page-local coordinates): big and a little above the
// middle when open in landscape, centred on the top half in portrait.
export function pageOrb(page: { w: number; h: number }, geometry: Geometry) {
  if (geometry === 'openPortrait') return { cx: page.w / 2, cy: page.h * 0.52, r: Math.min(page.w, page.h) * 0.3 };
  return { cx: page.w / 2, cy: page.h * 0.46, r: Math.min(page.w * 0.3, page.h * 0.21) };
}
