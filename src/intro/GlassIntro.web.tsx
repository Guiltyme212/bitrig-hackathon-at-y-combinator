import { useEffect, useRef } from 'react';
import { Asset } from 'expo-asset';
import type { SharedValue } from 'react-native-reanimated';
import type { WelcomeWords } from './types';
import { atmosphere, clamp, dragDistance, glassAt, rubberBand, shouldEnter, smooth, type Placement } from './choreography';
import { glassUniformNames, ORB_IN_POSTER, webGlass } from './glassMaterial';
import type { HapticMoment } from '../hapticFeedback';

type Props = {
  width: number;
  height: number;
  target: Placement;
  rest?: Placement | null;         // iPhone Duo sandbox: where the dome rests
  words?: WelcomeWords | null;     // iPhone Duo sandbox: the page the words sit on
  progress: SharedValue<number>;   // mirrors the lift, so the live orb can ride it
  reduced: boolean;
  onCommit: () => void;
  onArrive: () => void;
  onDone: () => void;
  feel: (moment: HapticMoment) => void;
};

const FONT = "'Avenir Next', Avenir, -apple-system, BlinkMacSystemFont, sans-serif";
const easeOut = (t: number) => 1 - Math.pow(1 - clamp(t), 3);

// cubic-bezier(.45,0,.2,1): the same glide the native tap uses.
function glide(x: number) {
  const [x1, y1, x2, y2] = [0.45, 0, 0.2, 1];
  const bx = (t: number) => 3 * (1 - t) * (1 - t) * t * x1 + 3 * (1 - t) * t * t * x2 + t * t * t;
  const by = (t: number) => 3 * (1 - t) * (1 - t) * t * y1 + 3 * (1 - t) * t * t * y2 + t * t * t;
  let t = x;
  for (let i = 0; i < 8; i++) {
    const d = (bx(t + 1e-4) - bx(t)) / 1e-4;
    if (Math.abs(d) < 1e-6) break;
    t = clamp(t - (bx(t) - x) / d);
  }
  return by(t);
}

// The web welcome. Reanimated's web shim doesn't keep a running animation and a
// requestAnimationFrame reader in step, so here the same material and choreography
// run on one plain loop: pointer drag, velocity handoff, spring, glide, hand-off.
export default function GlassIntro({ width, height, target, rest, words: page, progress, reduced, onCommit, onArrive, onDone }: Props) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const words = useRef<HTMLDivElement>(null);
  const tagline = useRef<HTMLParagraphElement>(null);
  const invite = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const props = useRef({ rest, width, height, target, progress, reduced, onCommit, onArrive, onDone });
  props.current = { rest, width, height, target, progress, reduced, onCommit, onArrive, onDone };
  const api = useRef<{ enter: (v: number | null) => void; scrub: (p: number) => void } | null>(null);

  useEffect(() => {
    const el = canvas.current!;
    const gl = el.getContext('webgl', { alpha: false, antialias: false });
    const s = {
      p: 0, v: 0, target: 0, mode: 'idle' as 'idle' | 'drag' | 'spring' | 'glide',
      glideFrom: 0, glideStart: 0, k: 0, c: 0,
      grabbedAt: 0, startY: 0, startX: 0, downAt: 0, lastY: 0, lastMoveT: 0, lastT: 0, vy: 0,
      contact: [0, 0, 0], force: 0, stretch: 0, prevP: 0, vel: 0,
      committed: false, arrived: false, arrivedAt: 0, done: false,
    };
    const began = performance.now();
    let frame = 0;
    let draw: ((time: number) => void) | null = null;
    let cleanupGl = () => {};

    if (gl) {
      try {
        const make = (type: number, source: string) => {
          const shader = gl.createShader(type)!;
          gl.shaderSource(shader, source);
          gl.compileShader(shader);
          if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(shader) || 'Glass shader error');
          return shader;
        };
        const vertex = make(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
        const fragment = make(gl.FRAGMENT_SHADER, webGlass);
        const program = gl.createProgram()!;
        gl.attachShader(program, vertex);
        gl.attachShader(program, fragment);
        gl.linkProgram(program);
        gl.useProgram(program);
        const buffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
        gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]), gl.STATIC_DRAW);
        const position = gl.getAttribLocation(program, 'p');
        gl.enableVertexAttribArray(position);
        gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);
        const u = Object.fromEntries([...glassUniformNames, 'pixelRatio', 'poster'].map(name => [name, gl.getUniformLocation(program, name)]));
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([0, 0, 0, 255]));
        for (const [key, value] of [[gl.TEXTURE_MIN_FILTER, gl.LINEAR], [gl.TEXTURE_MAG_FILTER, gl.LINEAR], [gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE], [gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE]]) gl.texParameteri(gl.TEXTURE_2D, key, value);
        const still = new window.Image();
        still.onload = () => { gl.bindTexture(gl.TEXTURE_2D, texture); gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, still); };
        still.src = Asset.fromModule(require('../../assets/orb/ember-poster.png')).uri;
        gl.uniform1i(u.poster, 0);
        draw = (time) => {
          const v = props.current;
          const ratio = Math.min(window.devicePixelRatio || 1, 2);
          const w = Math.round(v.width * ratio), h = Math.round(v.height * ratio);
          if (el.width !== w || el.height !== h) { el.width = w; el.height = h; gl.viewport(0, 0, w, h); }
          const glass = glassAt(s.p, v.width, v.height, v.target, v.rest);
          const scene = atmosphere(s.p);
          gl.uniform1f(u.pixelRatio, ratio);
          gl.uniform2f(u.resolution, v.width, v.height);
          gl.uniform1f(u.time, v.reduced ? 3 : time);
          gl.uniform1f(u.reduced, v.reduced ? 1 : 0);
          gl.uniform3f(u.sphere, glass.x, glass.y, glass.r);
          gl.uniform3f(u.contact, s.contact[0], s.contact[1], v.reduced ? 0 : s.force);
          gl.uniform1f(u.prism, scene.prism);
          gl.uniform1f(u.sky, scene.sky);
          gl.uniform1f(u.drift, scene.drift);
          gl.uniform1f(u.wobble, scene.wobble);
          gl.uniform1f(u.stretch, v.reduced ? 0 : s.stretch);
          gl.uniform1f(u.breath, v.reduced ? 0.5 : scene.calm * (0.5 + 0.5 * Math.sin(time * 0.9)));
          gl.uniform1f(u.appear, v.reduced ? 1 : easeOut(time / 1.4));
          gl.uniform1f(u.settle, scene.settle);
          gl.uniform3f(u.frame, glass.x, glass.y, glass.r / ORB_IN_POSTER);
          gl.activeTexture(gl.TEXTURE0);
          gl.bindTexture(gl.TEXTURE_2D, texture);
          gl.drawArrays(gl.TRIANGLES, 0, 6);
        };
        cleanupGl = () => { gl.deleteBuffer(buffer); gl.deleteTexture(texture); gl.deleteProgram(program); gl.deleteShader(vertex); gl.deleteShader(fragment); };
        el.dataset.renderer = 'glass-webgl';
      } catch (error) {
        el.dataset.error = String(error);
      }
    }

    const arrive = (now: number) => {
      if (s.arrived) return;
      s.arrived = true;
      s.arrivedAt = now;
      props.current.onArrive();
    };
    const enter = (launch: number | null) => {
      if (s.committed) return;
      s.committed = true;
      props.current.onCommit();
      if (props.current.reduced) { s.p = 1; arrive(performance.now()); return; }
      if (launch === null) { s.mode = 'glide'; s.glideFrom = s.p; s.glideStart = performance.now(); }
      // A critically damped spring (as on iOS) carrying the release velocity: no bounce, no pause.
      else { s.mode = 'spring'; s.target = 1; s.v = clamp(launch, 0, 6); s.k = 36; s.c = 12; }
    };
    api.current = { enter, scrub: (p: number) => { s.mode = 'idle'; s.p = p; } };

    const loop = (now: number) => {
      const t = (now - began) / 1000;
      const dt = Math.min(0.05, Math.max(1 / 240, (now - (s.lastT || now)) / 1000 || 1 / 60));
      if (s.mode === 'glide') {
        const k = clamp((now - s.glideStart) / 1500);
        s.p = s.glideFrom + (1 - s.glideFrom) * glide(k);
        if (k >= 1) s.mode = 'idle';
      } else if (s.mode === 'spring') {
        let remaining = dt;
        while (remaining > 0) { const h = Math.min(remaining, 1 / 120); s.v += (s.k * (s.target - s.p) - s.c * s.v) * h; s.p += s.v * h; remaining -= h; }
        if (Math.abs(s.target - s.p) < 0.0005 && Math.abs(s.v) < 0.005) { s.p = s.target; s.v = 0; s.mode = 'idle'; }
      }
      s.lastT = now;
      const vel = (s.p - s.prevP) / dt; s.prevP = s.p;
      s.vel += (vel - s.vel) * 0.25;
      s.stretch = clamp(s.vel * 0.045, -0.06, 0.07);
      s.force += ((s.mode === 'drag' ? 1 : 0) - s.force) * (1 - Math.exp(-dt * 12));
      props.current.progress.set(s.p);
      if (s.committed && s.p > 0.965) arrive(now);

      const reducedNow = props.current.reduced;
      const w = reducedNow ? 1 : easeOut((t - 0.45) / 0.9);
      const tl = reducedNow ? 1 : easeOut((t - 0.8) / 0.9);
      const inv = reducedNow ? 1 : easeOut((t - 1.25) / 0.8);
      if (words.current) {
        words.current.style.opacity = String(w * (1 - smooth(0.03, 0.3, s.p)));
        words.current.style.transform = `translateY(${(1 - w) * 10 - clamp(s.p) * 48}px)`;
      }
      if (tagline.current) tagline.current.style.opacity = String(tl);
      if (invite.current) {
        invite.current.style.opacity = String(inv * (1 - smooth(0, 0.16, s.p)));
        invite.current.style.transform = `translateY(${(1 - inv) * 8}px)`;
      }
      if (s.arrived && layer.current) {
        const f = clamp((now - s.arrivedAt) / (reducedNow ? 320 : 620));
        layer.current.style.opacity = String(1 - easeOut(f));
        if (f >= 1 && !s.done) { s.done = true; props.current.onDone(); return; }
      }
      draw?.(t);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    const box = layer.current!;
    const drag = () => dragDistance(props.current.width, props.current.height, props.current.target, props.current.rest);
    const local = (e: PointerEvent) => { const r = box.getBoundingClientRect(); return [(e.clientX - r.left) * props.current.width / r.width, (e.clientY - r.top) * props.current.height / r.height]; };
    const down = (e: PointerEvent) => {
      if (s.committed) return;
      box.setPointerCapture?.(e.pointerId);
      s.mode = 'drag'; s.grabbedAt = s.p; s.startY = e.clientY; s.startX = e.clientX; s.downAt = performance.now();
      s.lastY = e.clientY; s.lastMoveT = performance.now(); s.vy = 0; s.contact = [...local(e), 0];
    };
    const move = (e: PointerEvent) => {
      if (s.mode !== 'drag') return;
      const now = performance.now(), dtm = Math.max(1, now - s.lastMoveT);
      s.lastMoveT = now;
      s.vy = s.vy * 0.6 + ((e.clientY - s.lastY) / dtm * 1000) * 0.4;
      s.lastY = e.clientY;
      s.contact = [...local(e), 0];
      s.p = rubberBand(s.grabbedAt - (e.clientY - s.startY) / drag());
    };
    const up = (e: PointerEvent) => {
      if (s.mode !== 'drag') return;
      const moved = Math.hypot(e.clientX - s.startX, e.clientY - s.startY);
      if (moved < 6 && performance.now() - s.downAt < 450) { enter(null); return; }
      const v = -s.vy / drag();
      if (shouldEnter(s.p, v)) { enter(v); return; }
      s.mode = 'spring'; s.target = 0; s.v = v; s.k = 120; s.c = 20;
    };
    box.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    const hook = { enter: (v: number | null = null) => enter(v), scrub: (p: number) => { s.mode = 'idle'; s.p = p; }, release: (p: number, v: number) => { s.p = p; enter(v); }, state: () => ({ progress: s.p, committed: s.committed, arrived: s.arrived }) };
    if (__DEV__) (globalThis as { __kokoroIntro?: typeof hook }).__kokoroIntro = hook;
    return () => {
      cancelAnimationFrame(frame);
      box.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      cleanupGl();
      if (__DEV__) delete (globalThis as { __kokoroIntro?: typeof hook }).__kokoroIntro;
    };
  }, []);

  return <div ref={layer} role="dialog" aria-label="Welcome to Kokoro" style={{ position: 'absolute', inset: 0, zIndex: 30, background: '#000', touchAction: 'none', userSelect: 'none', cursor: 'grab', overflow: 'hidden' }}>
    <canvas ref={canvas} aria-hidden="true" style={{ position: 'absolute', inset: 0, width, height, display: 'block', pointerEvents: 'none' }} />
    <div ref={words} style={{ position: 'absolute', ...(page ? { left: page.x, width: page.w, top: page.top } : { left: 22, right: 22, top: height * 0.345 }), display: 'flex', flexDirection: 'column', alignItems: 'center', pointerEvents: 'none', opacity: 0 }}>
      <h1 style={{ margin: 0, fontFamily: FONT, fontSize: 70, lineHeight: '76px', letterSpacing: -4, fontWeight: 400, color: '#EEF1F6' }}>kokoro</h1>
      <p ref={tagline} style={{ margin: '21px 0 0', fontFamily: FONT, fontSize: 15, lineHeight: '23px', letterSpacing: -0.2, color: '#B7BDC8', textAlign: 'center', opacity: 0 }}>Meditations made for you<br />and your goals.</p>
    </div>
    <div ref={invite} style={{ position: 'absolute', ...(page ? { left: page.x, width: page.w, top: page.invite } : { left: 24, right: 24, top: height * 0.878 }), display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 0 }}>
      <button type="button" aria-label="Swipe up to enter. You can tap, too." onPointerDown={e => e.stopPropagation()} onClick={() => api.current?.enter(null)}
        style={{ minHeight: 44, display: 'flex', alignItems: 'center', gap: 13, padding: '0 13px', border: 0, background: 'transparent', fontFamily: FONT, fontSize: 14, letterSpacing: -0.15, color: '#F4F6FC', cursor: 'pointer' }}>
        Swipe up to enter
        <svg width={15} height={15} viewBox="0 0 24 24" fill="none" stroke="#ADC6E9" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 19V5M6 11l6-6 6 6" /></svg>
      </button>
      <p style={{ margin: '2px 0 0', fontFamily: FONT, fontSize: 11, color: '#A8BFDC' }}>You can tap, too.</p>
    </div>
  </div>;
}
