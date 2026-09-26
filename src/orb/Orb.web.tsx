import { useEffect, useRef } from 'react';
import { webFragment } from './shader';
export type OrbProps = { size: number; touching: boolean; reduced: boolean; mood: number };
export default function Orb({size,touching,reduced,mood}:OrbProps) {
  const canvas=useRef<HTMLCanvasElement>(null);
  const values=useRef({touching,reduced,mood});values.current={touching,reduced,mood};
  useEffect(()=>{
    const el=canvas.current!;
    const gl=el.getContext('webgl',{alpha:true,antialias:true,premultipliedAlpha:true});
    if(!gl){el.dataset.error='WebGL unavailable';return;}
    const make=(type:number,source:string)=>{const s=gl.createShader(type)!;gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw new Error(gl.getShaderInfoLog(s)||'Shader error');return s;};
    const vertex=make(gl.VERTEX_SHADER,'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}');
    const fragment=make(gl.FRAGMENT_SHADER,webFragment);
    const program=gl.createProgram()!;gl.attachShader(program,vertex);gl.attachShader(program,fragment);gl.linkProgram(program);gl.useProgram(program);
    const buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([-1,-1,1,-1,-1,1,-1,1,1,-1,1,1]),gl.STATIC_DRAW);
    const p=gl.getAttribLocation(program,'p');gl.enableVertexAttribArray(p);gl.vertexAttribPointer(p,2,gl.FLOAT,false,0,0);
    const u={resolution:gl.getUniformLocation(program,'resolution'),time:gl.getUniformLocation(program,'time'),touch:gl.getUniformLocation(program,'touch'),mood:gl.getUniformLocation(program,'mood')};
    let frame=0,force=0,previous=performance.now(),elapsed=0;
    const draw=(now:number)=>{const dt=Math.min((now-previous)/1000,.05);previous=now;const v=values.current;if(!document.hidden&&!v.reduced)elapsed+=dt;
      force+=(Number(v.touching)-force)*(1-Math.exp(-dt*10));
      if(!document.hidden){const dpr=Math.min(devicePixelRatio||1,2);const width=Math.round(el.clientWidth*dpr);if(el.width!==width){el.width=el.height=width;gl.viewport(0,0,width,width);}gl.uniform2f(u.resolution,el.width,el.height);gl.uniform1f(u.time,v.reduced?4:elapsed);gl.uniform1f(u.touch,force);gl.uniform1f(u.mood,v.mood);gl.drawArrays(gl.TRIANGLES,0,6);}
      frame=requestAnimationFrame(draw);
    };frame=requestAnimationFrame(draw);el.dataset.renderer='live-glass';
    return()=>{cancelAnimationFrame(frame);gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.deleteShader(vertex);gl.deleteShader(fragment);};
  },[]);
  return <canvas ref={canvas} style={{width:size,height:size,display:'block',pointerEvents:'none'}} aria-hidden="true"/>;
}
