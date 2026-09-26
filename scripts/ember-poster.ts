// Renders Ember's first frame to assets/orb/ember-poster.png, the still the welcome
// glass settles into before the live orb takes over. Re-run it whenever the Ember
// look or the liquid shader changes, or the hand-off will visibly jump.
// Needs Google Chrome (headless, software WebGL). Usage: npm run orb:poster
import { spawn } from 'node:child_process';
import { copyFileSync, existsSync, mkdtempSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { FIRST_TIME, liquidGl, lookUniforms, lookValues } from '../src/orb/liquid';

// 960² like the welcome's poster frame; the sphere's radius is 41.8% of it.
const SIZE = 960, R = SIZE * 0.418;
const uniforms = lookUniforms(lookValues('ember'), SIZE, R, FIRST_TIME, 0);
const html = `<!doctype html><body style="margin:0;background:#000"><canvas id="c" width="${SIZE}" height="${SIZE}" style="display:block"></canvas><script>
const gl = document.getElementById('c').getContext('webgl', { alpha: false, preserveDrawingBuffer: true });
const sh = (t, s) => { const x = gl.createShader(t); gl.shaderSource(x, s); gl.compileShader(x); return x; };
const p = gl.createProgram();
gl.attachShader(p, sh(gl.VERTEX_SHADER, 'attribute vec2 p; void main(){ gl_Position = vec4(p, 0.0, 1.0); }'));
gl.attachShader(p, sh(gl.FRAGMENT_SHADER, ${JSON.stringify(liquidGl)}));
gl.linkProgram(p); gl.useProgram(p);
gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
const a = gl.getAttribLocation(p, 'p'); gl.enableVertexAttribArray(a); gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);
gl.uniform1f(gl.getUniformLocation(p, 'uPixelRatio'), 1);
for (const [k, v] of Object.entries(${JSON.stringify(uniforms)})) {
  const l = gl.getUniformLocation(p, k);
  if (!Array.isArray(v)) gl.uniform1f(l, v); else [null, null, gl.uniform2fv, gl.uniform3fv, gl.uniform4fv][v.length].call(gl, l, v);
}
gl.clearColor(0, 0, 0, 1); gl.clear(gl.COLOR_BUFFER_BIT); gl.drawArrays(gl.TRIANGLES, 0, 3);
</script>`;

// Headless Chrome writes the screenshot but doesn't always exit, so wait for the
// file, give it a moment to finish, then close Chrome ourselves.
async function main() {
  const dir = mkdtempSync(path.join(tmpdir(), 'ember-poster-'));
  const page = path.join(dir, 'ember.html'), shot = path.join(dir, 'shot.png');
  const out = path.resolve('assets/orb/ember-poster.png');
  writeFileSync(page, html);
  const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
    '--headless=new', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--hide-scrollbars',
    '--force-device-scale-factor=1', `--user-data-dir=${path.join(dir, 'profile')}`, `--window-size=${SIZE},${SIZE}`,
    '--virtual-time-budget=1500', `--screenshot=${shot}`, `file://${page}`,
  ], { stdio: 'ignore' });
  const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));
  try {
    for (const deadline = Date.now() + 60000; !(existsSync(shot) && statSync(shot).size > 0) && Date.now() < deadline;) await wait(250);
    await wait(500);
    if (!existsSync(shot)) throw new Error('Chrome did not write the poster.');
    copyFileSync(shot, out);
    console.log(`Wrote ${out}`);
  } finally {
    chrome.kill();
    rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error instanceof Error ? error.message : error); process.exitCode = 1; });
