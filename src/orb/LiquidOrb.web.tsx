import { memo, useEffect, useRef } from 'react';
import { View } from 'react-native';
import type { DerivedValue, SharedValue } from 'react-native-reanimated';
import { advanceHand, advanceMotion, FIRST_FLOW, FIRST_TIME, liquidGl, lookUniforms, lookValues, noFinger, noRipple, openHand, type Finger, type Hand, type LookId, type LookValues, type Motion, type Ripple } from './liquid';

// The same orb in the browser, as a plain WebGL canvas (Skia isn't loaded on web).
type Props = { size: number; radius?: number; look: DerivedValue<LookValues> | LookId; level?: SharedValue<number>; touch?: SharedValue<number[]>; paused?: boolean; finger?: SharedValue<Finger>; still?: boolean };

function WebOrb({ size, radius = size * 0.29, look, level, touch, paused = false, finger, still = false }: Props) {
  const host = useRef<View>(null);
  const props = useRef({ look, level, touch, radius, size, paused, finger, still });
  props.current = { look, level, touch, radius, size, paused, finger, still };
  useEffect(() => {
    const node = host.current as unknown as HTMLElement | null;
    if (!node) return;
    const canvas = document.createElement('canvas');
    const ratio = Math.min(2, window.devicePixelRatio || 1);
    canvas.width = Math.round(size * ratio); canvas.height = Math.round(size * ratio);
    Object.assign(canvas.style, { width: `${size}px`, height: `${size}px`, display: 'block' });
    node.appendChild(canvas);
    const gl = canvas.getContext('webgl', { premultipliedAlpha: true, alpha: true });
    if (!gl) return () => { canvas.remove(); };
    const compile = (type: number, source: string) => { const s = gl.createShader(type)!; gl.shaderSource(s, source); gl.compileShader(s); return s; };
    const program = gl.createProgram()!;
    gl.attachShader(program, compile(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
    gl.attachShader(program, compile(gl.FRAGMENT_SHADER, liquidGl));
    gl.linkProgram(program);
    gl.useProgram(program);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const at = gl.getAttribLocation(program, 'p');
    gl.enableVertexAttribArray(at);
    gl.vertexAttribPointer(at, 2, gl.FLOAT, false, 0, 0);
    const where = (name: string) => gl.getUniformLocation(program, name);
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    // Time, the voice's smoothed energy, the ribbons' accumulated phase and the last
    // tap's ripple, advanced together once a frame (see advanceMotion).
    let frame = 0, last = performance.now(), time = FIRST_TIME, seen = 0;
    let motion: Motion = { energy: 0, flow: FIRST_FLOW };
    let ripple: Ripple = noRipple;
    let hand: Hand = openHand;
    const draw = () => {
      const { look: l, level: e, touch: t, radius: r, size: s, paused: hold, finger: f, still: fixed } = props.current;
      const now = performance.now();
      const real = hold ? 0 : Math.min(0.05, (now - last) / 1000);
      const dt = real * (reduced ? 0.3 : 1);
      last = now;
      time += dt;
      hand = advanceHand(hand, f?.value ?? noFinger, Date.now(), real);
      motion = advanceMotion(motion, Math.min(1, e?.value ?? 0) * 0.6, dt, hand.press);
      const [x, y, count] = t?.value ?? [0, 0, 0];
      if (count !== seen) { seen = count; ripple = [x, y, 0, reduced ? 0.5 : 1]; }
      else if (ripple[3] > 0) ripple = [ripple[0], ripple[1], ripple[2] + dt, ripple[2] > 4 ? 0 : ripple[3]];
      const values = typeof l === 'string' ? lookValues(l) : l.value;
      const u = fixed ? lookUniforms(values, s, r, FIRST_TIME, 0) : lookUniforms(values, s, r, time, motion.energy, hand.press, motion.flow, ripple, [hand.sx, hand.sy]);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.uniform1f(where('uPixelRatio'), ratio);
      for (const [name, value] of Object.entries(u)) {
        const loc = where(name);
        if (!Array.isArray(value)) gl.uniform1f(loc, value);
        else if (value.length === 2) gl.uniform2fv(loc, value);
        else if (value.length === 3) gl.uniform3fv(loc, value);
        else gl.uniform4fv(loc, value);
      }
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!fixed) frame = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(frame); canvas.remove(); };
  }, [size]);
  return <View ref={host} pointerEvents="none" style={{ width: size, height: size }} />;
}

const LiquidOrb = memo(WebOrb);
export default LiquidOrb;
export const LiquidStill = memo(function LiquidStill({ size, radius = size * 0.42, look }: { size: number; radius?: number; look: LookId }) {
  return <WebOrb size={size} radius={radius} look={look} still />;
});
