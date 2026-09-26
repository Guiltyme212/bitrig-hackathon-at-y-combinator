// One optical material shared by Skia (native) and WebGL (web).
export const material = `
uniform vec2 resolution;
uniform float time;
uniform float touch;
uniform float mood;

vec3 environment(vec3 d, float shift) {
  float t = time * 0.13;
  float a = atan(d.z, d.x);
  float ribbon = sin(a * 2.5 + d.y * 4.5 + t + shift) * .38;
  float stripe = exp(-pow((d.y - ribbon - .10) * 13.0, 2.0));
  float rim = exp(-pow((d.y + .32 + .20 * sin(a * 3.0 - t)) * 24.0, 2.0));
  float softbox = exp(-pow((a + 1.0) * 2.9, 2.0) - pow((d.y - .48) * 4.0, 2.0));
  float slit = exp(-pow((a - 1.8) * 7.0, 2.0)) * smoothstep(-.7, .5, d.y);
  vec3 blue = mix(vec3(.17,.22,.64), vec3(.19,.45,.47), mood * .55);
  vec3 color = vec3(.006,.009,.016);
  color += blue * stripe * .80;
  color += vec3(.61,.40,.55) * rim * .56;
  color += vec3(.82,.91,1.0) * softbox * 1.7;
  color += vec3(.78,.86,.97) * slit * .75;
  return color;
}

vec4 renderOrb(vec2 point) {
  vec2 uv = (point / resolution - .5) * 2.0;
  uv.y = -uv.y;
  float a = atan(uv.y,uv.x);
  float wave = .018 * sin(a * 3.0 + time * .29) + .011 * cos(a * 5.0 - time * .21);
  float radius = .77 + wave + touch * .026;
  vec2 p = uv / radius;
  p.x *= 1.0 + touch * .025;
  p.y *= 1.0 - touch * .04;
  float rr = dot(p,p);
  float mask = 1.0 - smoothstep(.986,1.008,rr);
  if (rr > 1.01) return vec4(0.0);
  float z = sqrt(max(0.001,1.0-rr));
  vec3 n = normalize(vec3(p, z));
  n = normalize(n + .028 * vec3(sin(p.y*7.0+time*.2),sin(p.x*8.0-time*.18),0.0));
  vec3 incident = vec3(0.0,0.0,-1.0);
  vec3 reflected = reflect(incident,n);
  vec3 r1 = refract(incident,n,1.0/1.44);
  vec3 r2 = refract(incident,n,1.0/1.47);
  vec3 r3 = refract(incident,n,1.0/1.50);
  vec3 trans = vec3(environment(r1+vec3(p*.80,0.0),.05).r,
                    environment(r2+vec3(p*.80,0.0),.0).g,
                    environment(r3+vec3(p*.80,0.0),-.05).b);
  vec3 back = environment(reflect(r2,-normalize(vec3(p,-z))),.7);
  float fresnel = .055 + .945*pow(1.0-z,4.4);
  vec3 color = mix(trans*.72 + back*.22,environment(reflected,0.0),.32+fresnel*.6);
  float lip = exp(-pow((sqrt(rr)-.961)*95.0,2.0));
  float edgeLight = .3+.7*pow(abs(sin(a-.5)),5.0);
  vec3 spectral = .55+.45*cos(vec3(0.0,2.1,4.2)+a*2.3+time*.12);
  color += lip * edgeLight * mix(vec3(.66,.76,.93),spectral,.35) * .62;
  float crescent = exp(-pow((length(p-vec2(.05,-.06))-.83)*32.0,2.0)) * smoothstep(.25,.9,-p.y);
  color += crescent*vec3(.39,.49,.70)*.32;
  float highlight = exp(-pow((p.x+.39)*15.0,2.0)-pow((p.y-.59)*8.0,2.0));
  color += highlight*vec3(.75,.83,.95);
  float clearEdge = exp(-pow((length(p-vec2(.16,-.08))-.84)*68.0,2.0)) * smoothstep(.12,.62,p.y) * (1.0-smoothstep(-.05,.6,p.x));
  color += clearEdge*vec3(.91,.94,1.0)*1.5;
  float lowerPrism = exp(-pow((length(p-vec2(-.05,.10))-.85)*52.0,2.0)) * smoothstep(.26,.8,-p.y);
  color += lowerPrism*mix(vec3(.77,.88,1.0),spectral,.32)*.8;
  color += touch*.045*vec3(.40,.49,.64)*(1.0-rr);
  color = pow(clamp(color,0.0,1.0),vec3(.85));
  return vec4(color*mask,mask);
}
`;

export const webFragment = `precision highp float;\n${material}\nvoid main(){ gl_FragColor=renderOrb(gl_FragCoord.xy); }`;
export const skiaFragment = material.replace(/\bvec2\b/g,'float2').replace(/\bvec3\b/g,'float3').replace(/\bvec4\b/g,'float4').replace(/atan\(([^,]+),([^\)]+)\)/g,'atan($1,$2)') + '\nhalf4 main(float2 xy){ return renderOrb(xy); }';
