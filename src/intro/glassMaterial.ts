// The welcome glass, ported from the approved kokoro-v3 optics: analytic sphere,
// Snell refraction of a sparse star field, studio reflections and a clear meniscus.
// As it rises a hint of Ember's thin film (red, orange, gold) reaches the rim, and in
// the last stretch Ember's first frame (assets/orb/ember-poster.png, rendered from the
// orb's own shader) settles into it, so the hand-off to the live orb is the same image.
// (The `prism`/`prismAt` names are from when Kokoro's orb was the Prism video.)
// Written in the GLSL subset both WebGL and Skia's SkSL accept.
const head = `
uniform vec2 resolution;
uniform float time;
uniform float reduced;
uniform vec3 sphere;
uniform vec3 contact;
uniform float prism;
uniform float sky;
uniform float drift;
uniform float wobble;
uniform float stretch;
uniform float breath;
uniform float appear;
uniform float settle;
uniform vec3 frame;
`;

const body = `
float sat(float x){return clamp(x,0.,1.);}
float sq(float x){return x*x;}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}

vec3 environment(vec3 direction){
  vec3 d=normalize(direction);
  float key=exp(-sq((d.x+.48)/.22)-sq((d.y+.62)/.4));
  float strip=exp(-sq((d.x-.65)/.09)-sq((d.y+.1)/.8));
  float foot=exp(-sq((d.x+.1)/.75)-sq((d.y-.8)/.085));
  float broad=exp(-sq((d.x+.1)/.75)-sq((d.y+.8)/.55));
  return vec3(.014,.018,.027)+vec3(.87,.94,1.04)*key*2.1
    +vec3(1.1,.69,.38)*strip*1.5+vec3(.28,.41,.54)*foot*.43+vec3(.3,.34,.42)*broad*.12;
}

vec3 backdrop(vec2 p){
  vec2 s=p+vec2(0.,drift);
  vec2 cell=floor(s/25.);
  vec2 delta=fract(s/25.)-(vec2(hash(cell+5.3),hash(cell+17.7))*.76+.12);
  float radius=mix(.012,.029,hash(cell+22.3));
  float star=exp(-dot(delta,delta)/(radius*radius))*step(.71,hash(cell));
  float h=hash(cell+41.8);
  float twinkle=.8+.2*sin(time*(.45+hash(cell+3.1)*.9)+hash(cell+9.2)*6.2831);
  float horizon=exp(-max(0.,resolution.y-p.y)/42.);
  vec3 night=vec3(.0017,.0025,.004)+vec3(.025,.12,.16)*horizon;
  return (night+vec3(.78,.85,1.)*star*twinkle*mix(.14,.52,h*h*h))*sky;
}

// Ember's palette for the thin film at the rim: deep red through orange to gold.
vec3 film(float t){
  float s=.5+.5*sin(6.28318*t);
  vec3 c=mix(vec3(.82,.2,.07),vec3(1.,.52,.14),smoothstep(.15,.65,s));
  return mix(c,vec3(1.,.8,.42),smoothstep(.72,1.,s));
}

vec3 sphereOptics(vec2 local,vec2 n2,vec2 world,float radius){
  float t=time;
  float radial=min(length(local),.9999);
  float z=sqrt(max(.0001,1.-radial*radial));
  vec3 surface=vec3(local,z);
  vec3 normal=normalize(vec3(n2*radial,z));
  float wave=.009*(1.-reduced)*(.2+prism*.8);
  normal=normalize(normal+vec3(sin(local.y*5.3+t*.41),cos(local.x*4.8-t*.32),0.)*wave);
  vec3 incoming=vec3(0.,0.,-1.);
  float ior=1.44;
  vec3 inside=refract(incoming,normal,1./ior);
  float path=max(.01,-2.*dot(surface,inside));
  vec3 exitPoint=surface+inside*path;
  vec3 exitNormal=normalize(exitPoint);
  vec3 outgoing=refract(inside,-exitNormal,ior);
  if(dot(outgoing,outgoing)<.001)outgoing=reflect(inside,-exitNormal);
  vec2 hit=world+(exitPoint.xy-local)*radius+outgoing.xy/max(.32,abs(outgoing.z))*radius*.35;
  float separation=pow(radial,5.)*(1.2+prism*3.);
  vec3 transmitted=backdrop(hit);
  transmitted.r=backdrop(hit+n2*separation).r;
  transmitted.b=backdrop(hit-n2*separation).b;
  transmitted*=exp(-vec3(.12,.075,.04)*path);
  float fresnel=.033+.967*pow(1.-z,5.);
  vec3 reflected=environment(reflect(incoming,normal));
  vec3 color=transmitted*(1.-fresnel)+reflected*(.18+fresnel*1.02);
  float crown=exp(-sq((radial-.976)/.021))*pow(sat(-n2.y),4.);
  float meniscus=exp(-sq((radial-.995)/.006));
  color+=vec3(.67,.76,.91)*crown*(.43+breath*.3)+environment(vec3(n2,.12))*meniscus*(.55+breath*.2);
  // Prism: thin-film colour flowing through the glass as it becomes Kokoro.
  float a=atan(local.y,local.x);
  float swirl=radial*1.4+sin(a*2.+t*.23)*.3+sin(local.y*3.1+local.x*2.-t*.17)*.25;
  vec3 tint=film(swirl+t*.03);
  float body=smoothstep(.2,.98,radial)*(.45+.55*sin(a*3.-t*.2+radial*4.));
  vec3 colored=color*.55+tint*(.26+fresnel*.8)*body+tint*meniscus*.35;
  color=mix(color,colored,prism);
  return 1.-exp(-color*1.4);
}

vec4 render(vec2 p){
  vec3 bg=backdrop(p);
  vec2 q=p-sphere.xy;
  q.y/=1.+stretch;
  q.x*=1.+stretch*.45;
  float len=max(length(q),.001);
  float a=atan(q.y,q.x);
  float r=sphere.z*(1.+wobble*(.03*sin(a*3.+time*.5)+.018*cos(a*5.-time*.37+1.3)));
  float spread=min(64.,sphere.z*.58);
  vec2 dl=p-contact.xy;
  float pressure=exp(-dot(dl,dl)/(spread*spread))*contact.z;
  float d=len-r+pressure*18.;
  vec2 n2=q/len;
  vec3 color;
  if(d>1.2){
    float halo=exp(-abs(d)/7.)*.027*(.35+.65*sky);
    color=bg+vec3(.34,.43,.57)*halo;
  }else{
    vec2 local=q/r;
    n2=normalize(n2-dl/spread*pressure*.62);
    vec3 glass=sphereOptics(local,n2,p,r);
    float mask=1.-smoothstep(-.7,1.,d);
    color=mix(bg,glass,mask);
  }
  // Ember's first frame, inside the glass and sized to it, so as the glass lands it
  // simply becomes the live orb. (No flash of light around it: glows read cheap.)
  vec3 still=prismAt(.5+(p-frame.xy)/frame.z);
  color=mix(color,still,settle);
  return vec4(color*appear,1.);
}
`;

const skiaPrism = `
uniform shader poster;
vec3 prismAt(vec2 uv){
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return vec3(0.);
  return vec3(poster.eval(uv*960.).rgb);
}
`;
const webPrism = `
uniform sampler2D poster;
vec3 prismAt(vec2 uv){
  if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)return vec3(0.);
  return texture2D(poster,uv).rgb;
}
`;

const toSkia = (source: string) => source
  .replace(/\bvec2\b/g, 'float2')
  .replace(/\bvec3\b/g, 'float3')
  .replace(/\bvec4\b/g, 'float4');

export const skiaGlass = `${toSkia(head + skiaPrism + body)}\nhalf4 main(float2 xy){return half4(render(xy));}`;

// WebGL's origin is bottom-left and in device pixels; the material works in points.
export const webGlass = `precision highp float;\nuniform float pixelRatio;\n${head}${webPrism}${body}\nvoid main(){vec2 xy=vec2(gl_FragCoord.x,resolution.y*pixelRatio-gl_FragCoord.y)/pixelRatio;gl_FragColor=render(xy);}`;

export const glassUniformNames = ['resolution', 'time', 'reduced', 'sphere', 'contact', 'prism', 'sky', 'drift', 'wobble', 'stretch', 'breath', 'appear', 'settle', 'frame'] as const;

// The poster is 960²; the orb's radius is 41.8% of it, centred (the Prism's framing).
export const PRISM_POSTER_SIZE = 960;
export const ORB_IN_POSTER = 0.418;
