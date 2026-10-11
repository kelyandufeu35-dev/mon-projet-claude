import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree, type ThreeEvent } from '@react-three/fiber';
import * as THREE from 'three';
import type { PartId } from '../lib/content';
import { PARTS } from '../lib/content';
import { TIER_SETTINGS, type TierSettings } from '../lib/quality';
import { frame, getUI, hotspotEls, setUI, useUI, type Tier } from '../lib/store';
import { createPose, damp, samplePose, smoothstep } from '../lib/timeline';
import { getGeometries } from './geometry';
import { createFloorMaterial, createHaloMaterial, createParticleMaterial, CYAN, getMaterials, ORANGE, shared } from './materials';
import { NexusCore } from './NexusCore';
import { PostFX } from './PostFX';

const BG = new THREE.Color('#020407');

/** Procedural studio environment: dark room, a few emissive strips. */
function buildEnvironment(gl: THREE.WebGLRenderer) {
  const env = new THREE.Scene();
  const box = new THREE.BoxGeometry(1, 1, 1);
  const room = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: '#07090c', side: THREE.BackSide }));
  room.scale.setScalar(30);
  env.add(room);
  const strip = (color: string, intensity: number, pos: [number, number, number], scale: [number, number, number]) => {
    const m = new THREE.Mesh(box, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity) }));
    m.position.set(...pos);
    m.scale.set(...scale);
    env.add(m);
  };
  // Neutral softboxes carry the metal; cyan and orange stay as accents.
  strip('#eef6ff', 3.2, [0, 9, 0], [8, 0.2, 2.5]);
  strip('#eef6ff', 3.5, [-9, 3, 4], [0.2, 5, 5]);
  strip('#eef6ff', 2.5, [8, 4, -6], [0.2, 4, 3]);
  strip('#45e3ff', 3, [-8, 0.5, -5], [0.2, 7, 0.4]);
  strip('#ff7a2f', 3, [5, -4, -8], [6, 0.2, 0.2]);
  strip('#ffffff', 1.4, [2, 2, 12], [4, 3, 0.2]);
  const pmrem = new THREE.PMREMGenerator(gl);
  const rt = pmrem.fromScene(env, 0.02);
  pmrem.dispose();
  env.traverse((o) => {
    if (o instanceof THREE.Mesh) (o.material as THREE.Material).dispose();
  });
  box.dispose();
  return rt.texture;
}

function Particles({ count }: { count: number }) {
  const dpr = useThree((s) => s.viewport.dpr);
  const geometry = useMemo(() => {
    const pos = new Float32Array(count * 3);
    const seed = new Float32Array(count * 4);
    let s = 1337;
    const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
    for (let i = 0; i < count; i++) {
      const r = 2.6 + Math.pow(rnd(), 0.7) * 6.5;
      const th = rnd() * Math.PI * 2;
      const y = (rnd() - 0.5) * 2 * (1.2 + r * 0.25);
      pos.set([Math.cos(th) * r, y, Math.sin(th) * r], i * 3);
      seed.set([rnd(), rnd(), rnd(), rnd()], i * 4);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('aSeed', new THREE.BufferAttribute(seed, 4));
    return g;
  }, [count]);
  const material = useMemo(() => createParticleMaterial(1), []);
  useEffect(() => {
    material.uniforms.uPixelRatio.value = dpr;
  }, [material, dpr]);
  useEffect(() => () => geometry.dispose(), [geometry]);
  return <points geometry={geometry} material={material} frustumCulled={false} raycast={() => {}} />;
}

function findPart(o: THREE.Object3D | null): PartId | null {
  while (o) {
    if (o.userData.part) return o.userData.part as PartId;
    o = o.parent;
  }
  return null;
}

interface SceneProps {
  settings: TierSettings;
  onReady: () => void;
}

function Scene({ settings, onReady }: SceneProps) {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const setDpr = useThree((s) => s.setDpr);
  const invalidate = useThree((s) => s.invalidate);

  const core = useMemo(() => new NexusCore(settings.sphereDetail), [settings.sphereDetail]);
  const geos = getGeometries(settings.sphereDetail);
  const floorMat = useMemo(() => createFloorMaterial(), []);
  const haloMats = useMemo(() => [createHaloMaterial(CYAN), createHaloMaterial(ORANGE)], []);
  const keyLight = useRef<THREE.DirectionalLight>(null!);
  const rimLight = useRef<THREE.DirectionalLight>(null!);
  const warmLight = useRef<THREE.DirectionalLight>(null!);
  const halo = useRef<THREE.Group>(null!);
  const fog = useMemo(() => new THREE.FogExp2(BG.getHex(), 0.3), []);

  // Per-frame scratch: allocated once.
  const st = useMemo(
    () => ({
      pose: createPose(),
      intro: 0,
      introStart: -1,
      idle: 0,
      az: 0,
      el: 0,
      zoom: 0,
      rotX: 0,
      rotY: 0,
      velX: 0,
      velY: 0,
      fov: 32,
      v: new THREE.Vector3(),
      n: new THREE.Vector3(),
      target: new THREE.Vector3(),
      ready: false,
      frames: 0,
      perfTime: 0,
      perfFrames: 0,
      cooldown: 0,
      dpr: Math.min(window.devicePixelRatio, settings.maxDpr),
    }),
    [settings.maxDpr],
  );

  useEffect(() => {
    frame.invalidate = invalidate;
    const env = buildEnvironment(gl);
    scene.environment = env;
    scene.background = BG;
    scene.fog = fog;
    return () => {
      env.dispose();
      frame.invalidate = () => {};
    };
  }, [gl, scene, invalidate, fog]);

  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    const id = findPart(e.object);
    if (id) {
      setUI({ hovered: id });
      document.body.style.cursor = 'pointer';
    }
  };
  const onOut = () => {
    setUI({ hovered: null });
    document.body.style.cursor = '';
  };
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    if (e.delta > 6) return; // a drag, not a click
    e.stopPropagation();
    const id = findPart(e.object);
    if (id) setUI({ selected: id });
  };

  useFrame((state, rawDelta) => {
    const t0 = performance.now();
    const ui = getUI();
    const motion = ui.motion;
    // Clamp long frames (tab switch) but let slow devices still catch up.
    const dt = Math.min(rawDelta, 0.1);
    const now = state.clock.elapsedTime;
    const { pose, v, n } = st;

    // --- Intro: the core emerges from the dark --------------------------
    if (st.introStart < 0) st.introStart = now;
    st.intro = motion ? Math.min(1, (now - st.introStart) / 3.6) : 1;
    const introCore = smoothstep(0, 0.55, st.intro);
    const introLight = smoothstep(0.2, 1, st.intro);

    // --- Timeline ----------------------------------------------------------
    frame.ts = motion ? damp(frame.ts, frame.t, 5, dt) : frame.t;
    if (Math.abs(frame.ts - frame.t) < 1e-4) frame.ts = frame.t;
    samplePose(frame.ts, pose);

    if (motion) shared.uTime.value += dt;
    shared.uGlow.value = pose.glow * (0.4 + 0.6 * introCore);
    shared.uWave.value = pose.wave;
    shared.uReveal.value = introCore;
    // Calibration pulses once the core is live.
    const live = smoothstep(0.98, 1.0, pose.wave);
    shared.uPulse.value = motion ? (shared.uTime.value * 0.22) % 1 : 0;
    shared.uPulseAmp.value = motion ? live * 0.35 : 0;

    // --- Object --------------------------------------------------------------
    core.setExplode(pose.explode);
    if (motion) core.spin(dt, pose.ringSpin);
    if (motion && !ui.explore) st.idle += dt * 0.045;
    // Pointer tilt on a damped spring: inertia without lag.
    const tx = motion && !ui.explore ? frame.py * 0.16 : 0;
    const ty = motion && !ui.explore ? frame.px * 0.26 : 0;
    if (motion) {
      st.velX += (tx - st.rotX) * 26 * dt;
      st.velY += (ty - st.rotY) * 26 * dt;
      st.velX *= Math.exp(-7.5 * dt);
      st.velY *= Math.exp(-7.5 * dt);
      st.rotX += st.velX * dt;
      st.rotY += st.velY * dt;
    } else {
      st.rotX = st.rotY = st.velX = st.velY = 0;
    }
    const root = core.root;
    root.rotation.set(st.rotX, pose.yaw + st.idle + st.rotY, 0);
    root.position.y = pose.lift - (1 - introCore) * 0.35;
    root.scale.setScalar(0.94 + 0.06 * introCore);
    core.coreLight.intensity = (1.5 + pose.glow * 4.5) * introCore;

    // Selection / hover rim.
    const mats = getMaterials();
    for (const p of PARTS) {
      const on = ui.selected === p.id || ui.hovered === p.id ? 1 : 0;
      const h = mats.highlights[p.id];
      h.value = motion ? damp(h.value, on, 10, dt) : on;
    }

    // --- Lights & atmosphere -------------------------------------------------
    const light = pose.light * introLight;
    keyLight.current.intensity = 2.8 * light;
    rimLight.current.intensity = 2.2 * light;
    warmLight.current.intensity = 1.4 * light;
    scene.environmentIntensity = 0.85 * light;
    fog.density = 0.022 + (1 - introLight) * 0.24;

    // Halo for the finale.
    const hv = pose.halo;
    halo.current.visible = hv > 0.001;
    if (halo.current.visible) {
      haloMats[0].opacity = 0.42 * hv;
      haloMats[1].opacity = 0.32 * hv;
      halo.current.scale.setScalar(0.85 + 0.15 * hv);
      if (motion) halo.current.rotation.y += dt * 0.05;
    }

    // --- Camera --------------------------------------------------------------
    const aspect = state.size.width / state.size.height;
    const portrait = aspect < 0.9;
    const fovTarget = portrait ? 46 : 32;
    if (st.fov !== fovTarget) {
      st.fov = fovTarget;
      camera.fov = fovTarget;
    }
    const lam = motion ? 6 : 1000;
    st.az = damp(st.az, ui.explore ? frame.orbitAz : 0, lam, dt);
    st.el = damp(st.el, ui.explore ? frame.orbitEl : 0, lam, dt);
    st.zoom = damp(st.zoom, ui.explore ? frame.zoom : 0, lam, dt);

    const halfTan = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    // Keep the framing of the desktop lens when the fov opens up.
    // 4:3 and tablet-landscape screens: step back and push the object further
    // from the text column.
    const narrow = portrait ? 0 : THREE.MathUtils.clamp((1.7 - aspect) / 0.5, 0, 1);
    let radius = ((pose.camR * Math.tan(THREE.MathUtils.degToRad(16))) / halfTan) * (1 + 0.32 * narrow);
    const fitR = 2.3 + pose.explode * 1.4 + pose.halo * 0.9;
    radius = Math.max(radius, fitR / (halfTan * Math.min(aspect, 1.4)));
    radius = Math.max(3.2, radius + st.zoom);
    const az = pose.camAz + st.az + (motion && !ui.explore ? frame.px * 0.04 : 0);
    const el = THREE.MathUtils.clamp(pose.camEl + st.el - (motion && !ui.explore ? frame.py * 0.03 : 0), -1.2, 1.25);
    camera.position.set(
      radius * Math.cos(el) * Math.sin(az),
      radius * Math.sin(el),
      radius * Math.cos(el) * Math.cos(az),
    );
    camera.lookAt(st.target);
    camera.aspect = aspect;
    camera.updateProjectionMatrix();
    // Off-axis framing: slide the object away from the text column.
    const sx = ui.explore ? 0 : portrait ? 0 : pose.shiftX * (1 + 0.6 * narrow);
    const sy = ui.explore ? 0 : portrait ? 0.44 + pose.shiftY * 0.1 : pose.shiftY;
    camera.projectionMatrix.elements[8] = -sx;
    camera.projectionMatrix.elements[9] = -sy;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();

    // --- Hotspots: project anchors to screen ---------------------------------
    root.updateMatrixWorld();
    camera.updateMatrixWorld();
    const showHotspots = ui.hotspots || ui.explore;
    if (showHotspots) {
      const w = state.size.width;
      const h = state.size.height;
      for (const p of PARTS) {
        const el2 = hotspotEls[p.id];
        if (!el2) continue;
        v.copy(core.anchors[p.id]).applyMatrix4(root.matrixWorld);
        n.copy(core.anchorNormals[p.id]).transformDirection(root.matrixWorld);
        const toCam = st.target.copy(camera.position).sub(v).normalize();
        const facing = p.id === 'core' ? 1 : smoothstep(-0.35, 0.15, n.dot(toCam));
        st.target.set(0, 0, 0);
        v.project(camera);
        const x = (v.x * 0.5 + 0.5) * w;
        const y = (-v.y * 0.5 + 0.5) * h;
        el2.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
        el2.style.setProperty('--facing', facing.toFixed(2));
      }
    }

    // --- Adaptive resolution -------------------------------------------------
    if (motion) {
      st.perfTime += rawDelta;
      st.perfFrames++;
      st.cooldown -= rawDelta;
      if (st.perfTime > 1.5) {
        const fps = st.perfFrames / st.perfTime;
        frame.fps = fps;
        if (fps < 48 && st.cooldown <= 0 && st.dpr > settings.minDpr) {
          st.dpr = Math.max(settings.minDpr, st.dpr - 0.25);
          setDpr(st.dpr);
          st.cooldown = 3;
        }
        st.perfTime = 0;
        st.perfFrames = 0;
      }
    }
    frame.dpr = st.dpr;

    // Ready once a few frames have gone through the full pipeline.
    if (!st.ready && ++st.frames > 2) {
      st.ready = true;
      onReady();
    }
    frame.updateMs += (performance.now() - t0 - frame.updateMs) * 0.05;
    // Keep rendering while damping converges in on-demand mode.
    if (!motion && Math.abs(frame.ts - frame.t) > 1e-4) invalidate();
  });

  return (
    <>
      <directionalLight ref={keyLight} position={[-4, 6, 4]} color="#e4f1ff" />
      <directionalLight ref={rimLight} position={[3, 1.5, -6]} color="#4fe6ff" />
      <directionalLight ref={warmLight} position={[5, -3, 2]} color="#ff7a2f" />
      <primitive object={core.root} onPointerOver={onOver} onPointerOut={onOut} onClick={onClick} />
      <group ref={halo} visible={false}>
        <mesh geometry={geos.halo} material={haloMats[0]} scale={3.3} raycast={() => {}} />
        <mesh geometry={geos.halo} material={haloMats[1]} scale={3.75} rotation={[0.08, 0, 0.1]} raycast={() => {}} />
      </group>
      <mesh geometry={geos.floor} material={floorMat} position={[0, -2.75, 0]} raycast={() => {}} renderOrder={-1} />
      <Particles count={settings.particles} />
      <PostFX settings={settings} />
    </>
  );
}

export default function Experience({ tier, onReady }: { tier: Tier; onReady: () => void }) {
  const motion = useUI((s) => s.motion);
  const settings = TIER_SETTINGS[tier];
  return (
    <Canvas
      className="stage-canvas"
      frameloop={motion ? 'always' : 'demand'}
      dpr={[settings.minDpr, settings.maxDpr]}
      gl={{ antialias: false, powerPreference: 'high-performance', stencil: false, alpha: false }}
      camera={{ fov: 32, near: 0.1, far: 80, position: [0, 0, 9] }}
      onCreated={({ gl }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping;
        gl.toneMappingExposure = 1.1;
      }}
      aria-hidden="true"
    >
      <Scene settings={settings} onReady={onReady} />
    </Canvas>
  );
}
