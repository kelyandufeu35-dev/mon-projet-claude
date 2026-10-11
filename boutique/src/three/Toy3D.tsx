import { useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * Illustrative treat-ball toy, built procedurally. It stands in for product
 * photos until real ones are added in config.ts. Drag to spin, tap to bounce.
 */

const NUBS = 46;
const KIBBLES = 9;
const tmpM = new THREE.Matrix4();
const tmpQ = new THREE.Quaternion();
const tmpV = new THREE.Vector3();
const tmpS = new THREE.Vector3();
const UP = new THREE.Vector3(0, 1, 0);
const tmpE = new THREE.Euler();
/** Where the treat opening sits on the ball (above the seam, facing forward). */
const OPENING = new THREE.Vector3(0, 0.42, 0.9).normalize();
const OPENING_Q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), OPENING);

function blobShadowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d')!;
  const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grd.addColorStop(0, 'rgba(20,22,43,0.42)');
  grd.addColorStop(0.55, 'rgba(20,22,43,0.14)');
  grd.addColorStop(1, 'rgba(20,22,43,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

interface ToyState {
  spinX: number;
  spinY: number;
  velX: number;
  velY: number;
  bounce: number; // seconds since last tap, large = idle
  dragging: boolean;
  lastX: number;
  lastY: number;
  moved: number;
}

function Toy({ color, motion, state }: { color: string; motion: boolean; state: React.MutableRefObject<ToyState> }) {
  const group = useRef<THREE.Group>(null!);
  const body = useRef<THREE.Group>(null!);
  const shadow = useRef<THREE.Mesh>(null!);
  const kibbles = useRef<THREE.InstancedMesh>(null!);
  const target = useMemo(() => new THREE.Color(color), [color]);

  const res = useMemo(() => {
    const shell = new THREE.MeshPhysicalMaterial({ color, roughness: 0.32, clearcoat: 0.8, clearcoatRoughness: 0.25 });
    const rubber = new THREE.MeshStandardMaterial({ color: new THREE.Color(color).offsetHSL(0, -0.05, -0.12), roughness: 0.62 });
    const ink = new THREE.MeshStandardMaterial({ color: '#16182d', roughness: 0.5 });
    const dial = new THREE.MeshStandardMaterial({ color: '#f7f4ee', roughness: 0.4 });
    const kibble = new THREE.MeshStandardMaterial({ color: '#b5713a', roughness: 0.85 });
    const shadowMat = new THREE.MeshBasicMaterial({ map: blobShadowTexture(), transparent: true, depthWrite: false });
    const nub = new THREE.SphereGeometry(0.11, 14, 10);
    const kib = new THREE.CapsuleGeometry(0.05, 0.05, 4, 8);
    // Fibonacci sphere for evenly spread rubber nubs, avoiding the opening.
    const nubMatrices: THREE.Matrix4[] = [];
    for (let i = 0; i < NUBS + 8; i++) {
      const y = 1 - (i / (NUBS + 7)) * 2;
      const r = Math.sqrt(1 - y * y);
      const th = i * Math.PI * (3 - Math.sqrt(5));
      tmpV.set(Math.cos(th) * r, y, Math.sin(th) * r);
      if (tmpV.dot(OPENING) > 0.8 || Math.abs(tmpV.y) < 0.08) continue; // opening + seam
      if (nubMatrices.length >= NUBS) break;
      tmpQ.setFromUnitVectors(UP, tmpV);
      tmpS.set(1, 0.7, 1);
      nubMatrices.push(new THREE.Matrix4().compose(tmpV.clone().multiplyScalar(1.0), tmpQ.clone(), tmpS.clone()));
    }
    return { shell, rubber, ink, dial, kibble, shadowMat, nub, kib, nubMatrices };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(
    () => () => {
      Object.values(res).forEach((v) => {
        if (v && typeof (v as { dispose?: () => void }).dispose === 'function') (v as { dispose: () => void }).dispose();
      });
    },
    [res],
  );

  const nubsRef = useRef<THREE.InstancedMesh>(null!);
  useEffect(() => {
    res.nubMatrices.forEach((m, i) => nubsRef.current.setMatrixAt(i, m));
    nubsRef.current.instanceMatrix.needsUpdate = true;
  }, [res]);

  // Kibbles spill from the opening on each bounce.
  const kibbleSeeds = useMemo(
    () =>
      Array.from({ length: KIBBLES }, (_, i) => ({
        vx: (Math.random() - 0.5) * 1.6,
        vy: 1.2 + Math.random() * 1.2,
        vz: 0.6 + Math.random() * 0.9,
        spin: Math.random() * 6,
        delay: i * 0.03,
      })),
    [],
  );

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.05);
    const s = state.current;
    res.shell.color.lerp(target, 1 - Math.exp(-8 * dt));
    res.rubber.color.copy(res.shell.color).offsetHSL(0, -0.05, -0.12);

    if (!s.dragging) {
      s.velX *= Math.exp(-2.2 * dt);
      s.velY *= Math.exp(-2.2 * dt);
      if (motion) s.velY += (0.35 - s.velY) * (1 - Math.exp(-0.6 * dt)); // gentle idle spin
    }
    s.spinX = THREE.MathUtils.clamp(s.spinX + s.velX * dt, -0.9, 0.9);
    s.spinY += s.velY * dt;
    // Ease back to a slight forward tilt so the opening stays visible.
    if (!s.dragging) s.spinX += (0.18 - s.spinX) * (1 - Math.exp(-1.5 * dt));
    body.current.rotation.set(s.spinX, s.spinY, 0);

    // Bounce with squash & stretch.
    s.bounce += dt;
    const b = s.bounce;
    let lift = 0;
    let squash = 1;
    if (b < 0.9) {
      const h = 0.9;
      const u = b / h;
      lift = Math.sin(u * Math.PI) * 0.9 * (1 - u * 0.3);
      if (u < 0.08) squash = 1 - (u / 0.08) * 0.18;
      else if (u > 0.92) squash = 1 - ((u - 0.92) / 0.08) * 0.14;
    } else if (b < 1.25) {
      const u = (b - 0.9) / 0.35;
      lift = Math.sin(u * Math.PI) * 0.18;
      squash = 1 + Math.sin(u * Math.PI * 2) * 0.04;
    } else if (motion) {
      lift = Math.sin(performance.now() / 900) * 0.04; // idle float
    }
    group.current.position.y = lift;
    group.current.scale.set(1 + (1 - squash) * 0.6, squash, 1 + (1 - squash) * 0.6);
    const shadowScale = 2.3 * (1 - lift * 0.35);
    shadow.current.scale.set(shadowScale, shadowScale, 1);
    (shadow.current.material as THREE.MeshBasicMaterial).opacity = 1 - lift * 0.45;

    // Kibbles.
    const k = kibbles.current;
    for (let i = 0; i < KIBBLES; i++) {
      const seed = kibbleSeeds[i];
      const t = b - 0.12 - seed.delay;
      if (t < 0 || t > 1.6) {
        tmpM.makeScale(0, 0, 0);
      } else {
        const x = seed.vx * t;
        const z = OPENING.z + seed.vz * t;
        const y = Math.max(-0.96, OPENING.y + lift + seed.vy * t - 4.9 * t * t);
        tmpQ.setFromEuler(tmpE.set(seed.spin * t, seed.spin * t * 0.7, 0));
        tmpM.compose(tmpV.set(x, y, z), tmpQ, tmpS.setScalar(t > 1.35 ? (1.6 - t) / 0.25 : 1));
      }
      k.setMatrixAt(i, tmpM);
    }
    k.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      <mesh ref={shadow} position={[0, -1.02, 0]} rotation={[-Math.PI / 2, 0, 0]} material={res.shadowMat}>
        <planeGeometry args={[1, 1]} />
      </mesh>
      <group ref={group}>
        <group ref={body}>
          {/* Two shell halves with a seam */}
          <mesh material={res.shell} castShadow>
            <sphereGeometry args={[1, 64, 48]} />
          </mesh>
          <mesh material={res.ink} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[1.0, 0.025, 10, 96]} />
          </mesh>
          <instancedMesh ref={nubsRef} args={[res.nub, res.rubber, NUBS]} />
          {/* Treat opening with difficulty dial */}
          <group position={OPENING.clone().multiplyScalar(0.95)} quaternion={OPENING_Q}>
            <mesh material={res.dial} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.36, 0.4, 0.2, 40]} />
            </mesh>
            <mesh material={res.ink} position={[0, 0, 0.101]}>
              <circleGeometry args={[0.17, 32]} />
            </mesh>
            {[0, 1, 2].map((i) => (
              <mesh key={i} material={res.ink} position={[Math.cos(1.2 + i * 0.35) * 0.27, Math.sin(1.2 + i * 0.35) * 0.27, 0.101]}>
                <circleGeometry args={[0.025 + i * 0.008, 12]} />
              </mesh>
            ))}
          </group>
        </group>
        <instancedMesh ref={kibbles} args={[res.kib, res.kibble, KIBBLES]} frustumCulled={false} />
      </group>
    </>
  );
}

function Rig() {
  const { camera, size } = useThree();
  useEffect(() => {
    const cam = camera as THREE.PerspectiveCamera;
    const aspect = size.width / size.height;
    cam.position.set(0, 0.35, aspect < 0.8 ? 6.4 : 5.4);
    cam.lookAt(0, -0.1, 0);
    cam.updateProjectionMatrix();
  }, [camera, size]);
  return null;
}

export default function Toy3D({ color, motion, label }: { color: string; motion: boolean; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(true);
  // With animations off, render only while the visitor plays with the toy.
  const [active, setActive] = useState(false);
  const idleTimer = useRef(0);
  const wake = () => {
    setActive(true);
    window.clearTimeout(idleTimer.current);
    idleTimer.current = window.setTimeout(() => setActive(false), 2200);
  };
  useEffect(() => () => window.clearTimeout(idleTimer.current), []);
  const state = useRef<ToyState>({ spinX: 0.18, spinY: -0.5, velX: 0, velY: 0, bounce: 9, dragging: false, lastX: 0, lastY: 0, moved: 0 });

  // Stop rendering when the hero is off screen.
  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => setVisible(e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const bounce = () => {
    state.current.bounce = 0;
    wake();
  };

  const onPointerDown = (e: React.PointerEvent) => {
    const s = state.current;
    s.dragging = true;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.moved = 0;
    wake();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const onPointerMove = (e: React.PointerEvent) => {
    const s = state.current;
    if (!s.dragging) return;
    const dx = e.clientX - s.lastX;
    const dy = e.clientY - s.lastY;
    s.lastX = e.clientX;
    s.lastY = e.clientY;
    s.moved += Math.abs(dx) + Math.abs(dy);
    s.velY = dx * 0.6;
    s.velX = dy * 0.4;
    s.spinY += dx * 0.012;
    s.spinX += dy * 0.008;
    wake();
  };
  const onPointerUp = () => {
    const s = state.current;
    s.dragging = false;
    if (s.moved < 6) bounce();
  };

  return (
    <div
      ref={wrap}
      className="toy3d"
      role="img"
      aria-label={label}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
    >
      <Canvas
        frameloop={visible ? (motion || active ? 'always' : 'demand') : 'never'}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        camera={{ fov: 30, near: 0.1, far: 50 }}
        onCreated={({ gl }) => {
          // Neutral tone mapping keeps the variant colours true to the swatches.
          gl.toneMapping = THREE.NeutralToneMapping;
          gl.toneMappingExposure = 1;
        }}
      >
        <Rig />
        <hemisphereLight args={['#ffffff', '#c9cfe6', 1.6]} />
        <directionalLight position={[3, 5, 4]} intensity={2.2} />
        <directionalLight position={[-4, 1, -2]} intensity={0.9} color="#ffd9e6" />
        <Toy color={color} motion={motion} state={state} />
      </Canvas>
      <button type="button" className="toy3d__hint" onClick={bounce}>
        Touche pour le faire rebondir
      </button>
    </div>
  );
}
