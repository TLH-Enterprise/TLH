import * as THREE from "three";

/**
 * Hero 3D: an abstract, slowly-morphing form built from an icosphere whose
 * vertices are displaced by animated simplex noise, shaded with a soft
 * two-tone violet gradient + fresnel rim. It gently follows the cursor.
 *
 * Designed to read premium/corporate on a light background — not gamey.
 * Falls back silently to the CSS orb if WebGL is unavailable.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uAmp;

  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying float vDisp;

  // Simplex noise 3D — Ashima Arts / Stefan Gustavson (MIT / public domain)
  vec3 mod289(vec3 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 mod289(vec4 x){ return x - floor(x * (1.0/289.0)) * 289.0; }
  vec4 permute(vec4 x){ return mod289(((x*34.0)+1.0)*x); }
  vec4 taylorInvSqrt(vec4 r){ return 1.79284291400159 - 0.85373472095314 * r; }

  float snoise(vec3 v){
    const vec2 C = vec2(1.0/6.0, 1.0/3.0);
    const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
    vec3 i  = floor(v + dot(v, C.yyy));
    vec3 x0 = v - i + dot(i, C.xxx);
    vec3 g = step(x0.yzx, x0.xyz);
    vec3 l = 1.0 - g;
    vec3 i1 = min(g.xyz, l.zxy);
    vec3 i2 = max(g.xyz, l.zxy);
    vec3 x1 = x0 - i1 + C.xxx;
    vec3 x2 = x0 - i2 + C.yyy;
    vec3 x3 = x0 - D.yyy;
    i = mod289(i);
    vec4 p = permute(permute(permute(
              i.z + vec4(0.0, i1.z, i2.z, 1.0))
            + i.y + vec4(0.0, i1.y, i2.y, 1.0))
            + i.x + vec4(0.0, i1.x, i2.x, 1.0));
    float n_ = 0.142857142857;
    vec3 ns = n_ * D.wyz - D.xzx;
    vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
    vec4 x_ = floor(j * ns.z);
    vec4 y_ = floor(j - 7.0 * x_);
    vec4 x = x_ * ns.x + ns.yyyy;
    vec4 y = y_ * ns.x + ns.yyyy;
    vec4 h = 1.0 - abs(x) - abs(y);
    vec4 b0 = vec4(x.xy, y.xy);
    vec4 b1 = vec4(x.zw, y.zw);
    vec4 s0 = floor(b0)*2.0 + 1.0;
    vec4 s1 = floor(b1)*2.0 + 1.0;
    vec4 sh = -step(h, vec4(0.0));
    vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy;
    vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww;
    vec3 p0 = vec3(a0.xy, h.x);
    vec3 p1 = vec3(a0.zw, h.y);
    vec3 p2 = vec3(a1.xy, h.z);
    vec3 p3 = vec3(a1.zw, h.w);
    vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2,p2), dot(p3,p3)));
    p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
    vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
    m = m * m;
    return 42.0 * dot(m*m, vec4(dot(p0,x0), dot(p1,x1), dot(p2,x2), dot(p3,x3)));
  }

  float fbm(vec3 p){
    float n = snoise(p * 1.4 + vec3(0.0, 0.0, uTime * 0.20));
    n += 0.5 * snoise(p * 2.8 - vec3(uTime * 0.16, 0.0, 0.0));
    n += 0.25 * snoise(p * 5.6 + vec3(0.0, uTime * 0.12, 0.0));
    return n;
  }

  float dispAt(vec3 dir){ return fbm(dir) * uAmp; }

  void main(){
    vec3 dir = normalize(position);

    // Build a tangent basis to sample neighbours for a perturbed normal
    vec3 up = abs(dir.y) < 0.99 ? vec3(0.0, 1.0, 0.0) : vec3(1.0, 0.0, 0.0);
    vec3 t1 = normalize(cross(dir, up));
    vec3 t2 = cross(dir, t1);
    float eps = 0.08;

    float dC = dispAt(dir);
    vec3 pC = position + dir * dC;
    vec3 dirA = normalize(position + t1 * eps);
    vec3 dirB = normalize(position + t2 * eps);
    vec3 pA = (position + t1 * eps) + dirA * dispAt(dirA);
    vec3 pB = (position + t2 * eps) + dirB * dispAt(dirB);

    vec3 nrm = normalize(cross(pA - pC, pB - pC));
    if (dot(nrm, dir) < 0.0) nrm = -nrm;

    vDisp = dC;
    vNormal = normalize(normalMatrix * nrm);

    vec4 mvPosition = modelViewMatrix * vec4(pC, 1.0);
    vViewPos = -mvPosition.xyz;
    gl_Position = projectionMatrix * mvPosition;
  }
`;

const fragmentShader = /* glsl */ `
  precision highp float;

  uniform vec3 uDeep;
  uniform vec3 uLight;
  uniform vec3 uRim;
  uniform float uAmp;

  varying vec3 vNormal;
  varying vec3 vViewPos;
  varying float vDisp;

  void main(){
    vec3 nrm = normalize(vNormal);
    vec3 keyLight = normalize(vec3(0.45, 0.85, 0.75));
    vec3 fillLight = normalize(vec3(-0.7, -0.15, 0.4));

    float diff = clamp(dot(nrm, keyLight), 0.0, 1.0);
    float fill = clamp(dot(nrm, fillLight), 0.0, 1.0) * 0.28;

    float m = clamp(vDisp / max(uAmp, 0.0001) * 0.5 + 0.5, 0.0, 1.0);
    vec3 base = mix(uDeep, uLight, m);

    vec3 lit = base * (0.42 + 0.72 * diff) + base * fill;

    vec3 viewDir = normalize(vViewPos);
    float fres = pow(1.0 - clamp(dot(viewDir, nrm), 0.0, 1.0), 3.0);
    lit += uRim * fres * 0.9;

    // subtle specular sheen
    vec3 halfDir = normalize(keyLight + viewDir);
    float spec = pow(clamp(dot(nrm, halfDir), 0.0, 1.0), 24.0) * 0.25;
    lit += vec3(spec);

    gl_FragColor = vec4(lit, 1.0);
  }
`;

type Disposer = () => void;

function prefersReducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

export function initHero3D(canvas: HTMLCanvasElement): Disposer | null {
  const container = canvas.parentElement;
  if (!container) return null;

  let renderer: THREE.WebGLRenderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
      powerPreference: "high-performance",
    });
  } catch {
    return null;
  }

  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  const reduced = prefersReducedMotion();

  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  // Pulled back enough that the displaced form + noise spikes never clip the frame.
  camera.position.set(0, 0, 4.9);

  const detail = isMobile ? 20 : 48;
  const geometry = new THREE.IcosahedronGeometry(1, detail);

  const uniforms = {
    uTime: { value: 0 },
    uAmp: { value: 0.22 },
    uDeep: { value: new THREE.Color(0x4c1d95) },
    uLight: { value: new THREE.Color(0xa78bfa) },
    uRim: { value: new THREE.Color(0xd6c8ff) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
  });

  const mesh = new THREE.Mesh(geometry, material);
  scene.add(mesh);

  function resize() {
    const rect = container!.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  // Cursor parallax (lerped)
  const target = { x: 0, y: 0 };
  const current = { x: 0, y: 0 };
  function onPointer(e: PointerEvent) {
    const rect = container!.getBoundingClientRect();
    target.x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    target.y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
  }
  if (!reduced) window.addEventListener("pointermove", onPointer, { passive: true });

  const ro = new ResizeObserver(resize);
  ro.observe(container);

  let visible = true;
  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) visible = entry.isIntersecting;
    },
    { threshold: 0.01 }
  );
  io.observe(container);

  const clock = new THREE.Clock();
  let raf = 0;
  let running = true;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    uniforms.uTime.value = reduced ? 1.6 : t;

    current.x += (target.x - current.x) * 0.05;
    current.y += (target.y - current.y) * 0.05;

    if (reduced) {
      mesh.rotation.set(-0.15, 0.6, 0.08);
    } else {
      mesh.rotation.y = t * 0.12 + current.x * 0.5;
      mesh.rotation.x = current.y * 0.4 - 0.05;
    }

    renderer.render(scene, camera);
  }

  if (reduced) {
    resize();
    uniforms.uTime.value = 1.6;
    mesh.rotation.set(-0.15, 0.6, 0.08);
    renderer.render(scene, camera);
  } else {
    frame();
  }

  container.classList.add("is-ready");

  return () => {
    running = false;
    cancelAnimationFrame(raf);
    ro.disconnect();
    io.disconnect();
    window.removeEventListener("pointermove", onPointer);
    geometry.dispose();
    material.dispose();
    renderer.dispose();
  };
}
