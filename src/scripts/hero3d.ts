import * as THREE from "three";

/**
 * Hero 3D: "arena morada" — a sphere formed by ~26k fine purple sand grains
 * that slowly rotates and shimmers (each grain drifts a little), shaded so the
 * orb reads as a volume. No tornado/vortex; just a calm, premium sand orb.
 * Follows the cursor. Falls back to the CSS orb if WebGL is unavailable;
 * static under prefers-reduced-motion.
 */

const vertexShader = /* glsl */ `
  uniform float uTime;
  uniform float uForm;   // 0..1 materialize (alpha + subtle scale)
  uniform float uScale;  // point-size scale
  uniform vec3 uColorLow;
  uniform vec3 uColorMid;
  uniform vec3 uColorHigh;

  attribute float aSeed;
  attribute float aSize;

  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    vec3 n = normalize(position);
    float tw = aSeed * 6.2831853;

    // Per-grain shimmer along the surface normal
    float disp = 0.05 * sin(uTime * 0.9 + tw + position.y * 3.0)
               + 0.03 * sin(uTime * 1.7 + position.x * 4.0 + tw);

    float rScale = mix(0.92, 1.0, uForm);
    vec3 p = position * rScale + n * disp;

    // Shading from a view-space normal so the orb reads as a 3D volume
    vec3 vn = normalize(normalMatrix * n);
    vec3 lightDir = normalize(vec3(0.4, 0.7, 0.75));
    float diff = clamp(dot(vn, lightDir), 0.0, 1.0);
    float front = clamp(vn.z * 0.5 + 0.5, 0.0, 1.0); // 1 front, 0 back

    vec3 c = mix(uColorLow, uColorMid, diff);
    c = mix(c, uColorHigh, pow(diff, 2.0) * 0.7);
    vColor = c;

    // Front grains brighter/opaque, back grains dimmer -> depth
    vAlpha = (0.22 + 0.78 * front) * uForm;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_PointSize = aSize * uScale / max(-mv.z, 0.1);
    gl_Position = projectionMatrix * mv;
  }
`;

const fragmentShader = /* glsl */ `
  precision mediump float;
  varying vec3 vColor;
  varying float vAlpha;

  void main() {
    float d = length(gl_PointCoord - 0.5);
    if (d > 0.5) discard;
    float soft = smoothstep(0.5, 0.12, d);
    gl_FragColor = vec4(vColor, vAlpha * soft);
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
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
  camera.position.set(0, 0, 3.9);

  const COUNT = isMobile ? 9000 : 26000;
  const positions = new Float32Array(COUNT * 3);
  const seed = new Float32Array(COUNT);
  const size = new Float32Array(COUNT);

  for (let i = 0; i < COUNT; i++) {
    // Uniform direction on a sphere, with a thin shell of jitter
    const u = Math.random();
    const v = Math.random();
    const theta = 2 * Math.PI * u;
    const phi = Math.acos(2 * v - 1);
    const r = 0.9 + Math.random() * 0.16;
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.cos(phi);
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta);
    seed[i] = Math.random();
    size[i] = 1.0 + Math.random() * 1.4;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seed, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(size, 1));

  const uniforms = {
    uTime: { value: 0 },
    uForm: { value: reduced ? 1 : 0 },
    uScale: { value: 9 * renderer.getPixelRatio() },
    uColorLow: { value: new THREE.Color(0x4c1d95) },
    uColorMid: { value: new THREE.Color(0x7c3aed) },
    uColorHigh: { value: new THREE.Color(0xc4b5fd) },
  };

  const material = new THREE.ShaderMaterial({
    vertexShader,
    fragmentShader,
    uniforms,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });

  const points = new THREE.Points(geometry, material);
  scene.add(points);

  function resize() {
    const rect = container!.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    uniforms.uScale.value = 9 * renderer.getPixelRatio();
  }
  resize();

  const targetRot = { x: 0, y: 0 };
  const curRot = { x: 0, y: 0 };
  function onPointer(e: PointerEvent) {
    const rect = container!.getBoundingClientRect();
    targetRot.y = ((e.clientX - rect.left) / rect.width - 0.5) * 0.7;
    targetRot.x = ((e.clientY - rect.top) / rect.height - 0.5) * 0.5;
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
  const introDuration = 1.6;

  function frame() {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    if (!visible) return;

    const t = clock.getElapsedTime();
    uniforms.uTime.value = t;

    const pr = Math.min(1, t / introDuration);
    uniforms.uForm.value = 1 - Math.pow(1 - pr, 3);

    curRot.x += (targetRot.x - curRot.x) * 0.05;
    curRot.y += (targetRot.y - curRot.y) * 0.05;
    points.rotation.y = t * 0.09 + curRot.y;
    points.rotation.x = curRot.x;

    renderer.render(scene, camera);
  }

  if (reduced) {
    uniforms.uForm.value = 1;
    uniforms.uTime.value = 2.0;
    points.rotation.set(0, 0.4, 0);
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
