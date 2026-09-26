import { createContext, useContext, useEffect, useMemo, useState, useSyncExternalStore, type ReactNode } from 'react';
import { LogBox, Platform, StyleSheet, useWindowDimensions, View, type ViewStyle } from 'react-native';
import { SafeAreaInsetsContext, useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { duoLayout, SANDBOX, type DuoLayout, type Geometry, type Insets, type Rect } from './geometry';

export type { DuoLayout, Rect, Insets } from './geometry';

// One unhurried spring for every pose change (fold, unfold, rotate): it arrives without a bounce.
export const POSE_SPRING = { dampingRatio: 0.92, duration: 900 };

const DuoContext = createContext<DuoLayout | null>(null);
type Frame = { rect: Rect; insets: Insets };
const FrameContext = createContext<Frame | null>(null);

function sandboxGeometry(): Geometry | null {
  if (Platform.OS !== 'web' || typeof window === 'undefined' || !window.location) return null;
  const v = new URLSearchParams(window.location.search).get('duo');
  return v && SANDBOX[v] ? (v as Geometry) : null;
}

// Mounted once, inside SafeAreaProvider. On a phone (and in Expo Go, and on the web) the
// layout is 'phone' and nothing below changes a single pixel.
export function DuoProvider({ children }: { children: ReactNode }) {
  const win = useWindowDimensions();
  const sys = useSafeAreaInsets();
  const [sandbox, setSandbox] = useState(sandboxGeometry);
  // Same-origin browser QA can change poses without reloading the session.
  useEffect(() => {
    if (!__DEV__ || Platform.OS !== 'web' || typeof window === 'undefined' ||
        new URLSearchParams(window.location.search).get('qa') !== '1') return;
    const changePose = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent ||
          event.data?.type !== 'kokoro:preview-pose') return;
      const pose = event.data.pose;
      if (typeof pose === 'string' && Object.hasOwn(SANDBOX, pose)) setSandbox(pose as Geometry);
      else if (pose === 'phone') setSandbox(null);
    };
    window.addEventListener('message', changePose);
    return () => window.removeEventListener('message', changePose);
  }, []);
  // The window can change under the app (it moves between the Duo's two displays); the
  // root view's own size is the most reliable measure of where the app now lives.
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null);
  const L = useMemo(() => {
    if (sandbox) { const s = SANDBOX[sandbox]; return duoLayout({ w: s.w, h: s.h }, s.insets, sandbox); }
    const size = measured ?? { w: win.width, h: win.height };
    return duoLayout(size, { top: sys.top, right: sys.right, bottom: sys.bottom, left: sys.left });
  }, [sandbox, measured, win.width, win.height, sys.top, sys.right, sys.bottom, sys.left]);

  // The Duo build is a Debug build on demo day: keep LogBox's warning toasts off the glass.
  useEffect(() => { if (L.duo && Platform.OS !== 'web') LogBox.ignoreAllLogs(true); }, [L.duo]);
  useEffect(() => {
    if (!__DEV__) return;
    const g = globalThis as Record<string, unknown>;
    g.__duo = { layout: () => L, overlay: (on = true) => overlayStore.set(on) };
    if (L.duo) console.log(`[duo] ${L.key} insets T${L.insets.top} R${L.insets.right} B${L.insets.bottom} L${L.insets.left}`);
  }, [L]);

  return <DuoContext.Provider value={L}>
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none"
      onLayout={e => { const { width, height } = e.nativeEvent.layout; if (!measured || measured.w !== width || measured.h !== height) setMeasured({ w: width, h: height }); }}>
      {children}
      {__DEV__ && L.duo && <DuoOverlay L={L} />}
    </View>
  </DuoContext.Provider>;
}

const PHONE = duoLayout({ w: 402, h: 874 }, { top: 0, right: 0, bottom: 0, left: 0 }, 'phone');
export function useDuo(): DuoLayout {
  return useContext(DuoContext) ?? PHONE;
}

// The frame a screen lays itself out in: the nearest Region, else the whole window on a
// phone, else the Duo's column (the closed display's 382 column, or the words page).
export function useFrame(): Frame & { width: number; height: number } {
  const L = useDuo();
  const frame = useContext(FrameContext);
  const win = useWindowDimensions();
  const sys = useSafeAreaInsets();
  if (frame) return { ...frame, width: frame.rect.w, height: frame.rect.h };
  if (!L.duo) return { rect: { x: 0, y: 0, w: win.width, h: win.height }, insets: sys, width: win.width, height: win.height };
  return { ...L.column, width: L.column.rect.w, height: L.column.rect.h };
}
// Drop-in for useWindowDimensions() in layout maths: identical on a phone.
export function useFrameSize() {
  const { width, height } = useFrame();
  const { fontScale, scale } = useWindowDimensions();
  return { width, height, fontScale, scale };
}

// Places its children in a rect of the window and makes that rect look like a whole phone
// to everything inside (useFrame, useFrameSize and useSafeAreaInsets all see the rect).
// Keep it mounted in the same place across poses and change only `rect`: the children never
// remount (audio, recording and drafts survive a fold), and the move glides.
export function Region({ rect, insets, children, style, pointerEvents = 'box-none', glide = true }: {
  rect: Rect; insets?: Insets; children?: ReactNode; style?: ViewStyle; pointerEvents?: 'box-none' | 'none' | 'auto'; glide?: boolean;
}) {
  const L = useDuo();
  const own = insets ?? { top: 0, right: 0, bottom: 0, left: 0 };
  const x = useSharedValue(rect.x), y = useSharedValue(rect.y);
  useEffect(() => {
    if (!glide) { x.set(rect.x); y.set(rect.y); return; }
    x.set(withSpring(rect.x, POSE_SPRING));
    y.set(withSpring(rect.y, POSE_SPRING));
  }, [rect.x, rect.y, glide, x, y]);
  const moved = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }, { translateY: y.get() }] }));
  const value = useMemo(() => ({ rect: { x: 0, y: 0, w: rect.w, h: rect.h }, insets: own }),
    [rect.w, rect.h, own.top, own.right, own.bottom, own.left]); // eslint-disable-line react-hooks/exhaustive-deps
  if (!L.duo) return <>{children}</>;
  return <Animated.View pointerEvents={pointerEvents} style={[{ position: 'absolute', left: 0, top: 0, width: rect.w, height: rect.h }, style, moved]}>
    <FrameContext.Provider value={value}>
      <SafeAreaInsetsContext.Provider value={own}>{children}</SafeAreaInsetsContext.Provider>
    </FrameContext.Provider>
  </Animated.View>;
}

// The standard two regions of a screen that has an orb and words. Closed: both are the
// column (the phone layout, orb above the words). Open: the orb gets its page and the
// words theirs. `split` tells the screen which of the two compositions to draw.
export function useRegions() {
  const L = useDuo();
  return useMemo(() => {
    const col = L.column;
    if (!L.pages) return { split: false as const, orb: col, words: col, fold: L.fold, L };
    const orbInsets = { top: Math.max(L.insets.top, 18), right: 0, bottom: Math.max(L.insets.bottom, 16), left: 0 };
    return { split: true as const, orb: { rect: L.pages.orb, insets: orbInsets }, words: col, fold: L.fold, L };
  }, [L]);
}

// A shared value that follows a target: it jumps on a phone (or with reduced motion) and
// otherwise springs with the pose spring, so layout numbers that change with the pose glide.
export function useGlide(target: number, reduced = false) {
  const L = useDuo();
  const v = useSharedValue(target);
  useEffect(() => {
    if (!L.duo || reduced) v.set(target); else v.set(withSpring(target, POSE_SPRING));
  }, [target, reduced, L.duo, v]);
  return v;
}

// ---- dev overlay: the fold band in red, the system strip in blue (QA screenshots) ----
let overlayOn = false;
const listeners = new Set<() => void>();
const overlayStore = {
  set(on: boolean) { overlayOn = on; listeners.forEach(l => l()); },
  subscribe(l: () => void) { listeners.add(l); return () => { listeners.delete(l); }; },
  get: () => overlayOn,
};
function DuoOverlay({ L }: { L: DuoLayout }) {
  const on = useSyncExternalStore(overlayStore.subscribe, overlayStore.get, overlayStore.get);
  if (!on) return null;
  const { w, h } = L.window, i = L.insets;
  const boxes: { r: Rect; c: string }[] = [];
  if (i.right >= 60) boxes.push({ r: { x: w - i.right, y: 0, w: i.right, h }, c: 'rgba(80,140,255,0.22)' });
  if (i.left >= 60) boxes.push({ r: { x: 0, y: 0, w: i.left, h }, c: 'rgba(80,140,255,0.22)' });
  if (L.fold) {
    const [a, b] = L.fold.band;
    boxes.push({ r: L.fold.axis === 'x' ? { x: a, y: 0, w: b - a, h } : { x: 0, y: a, w, h: b - a }, c: 'rgba(255,70,70,0.28)' });
  }
  return <View pointerEvents="none" style={StyleSheet.absoluteFill}>
    {boxes.map((b, n) => <View key={n} style={{ position: 'absolute', left: b.r.x, top: b.r.y, width: b.r.w, height: b.r.h, backgroundColor: b.c }} />)}
  </View>;
}
