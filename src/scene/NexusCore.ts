import * as THREE from 'three';
import type { PartId } from '../lib/content';
import { getGeometries, INJECTOR_RADIUS, SHELL } from './geometry';
import { getMaterials } from './materials';

const Y = new THREE.Vector3(0, 1, 0);
const noRaycast = () => {};

const UPPER_PETALS = 6;
const CROWN_Y = 1.56;
const INJECTOR_ANGLES = [0.25, 0.75, 1.25, 1.75].map((k) => k * Math.PI);
const FIN_COUNT = 12;
const BOLT_COUNT = 12;

/**
 * The NEXUS energy core, built imperatively so the per-frame update can write
 * instance matrices directly without React reconciliation.
 */
export class NexusCore {
  readonly root = new THREE.Group();
  readonly anchors: Record<PartId, THREE.Vector3>;
  /** Outward normal used to fade anchors facing away from the camera. */
  readonly anchorNormals: Record<PartId, THREE.Vector3>;

  private ringA = new THREE.Group();
  private ringB = new THREE.Group();
  private ringC = new THREE.Group();
  private ringATilt = new THREE.Group();
  private ringBTilt = new THREE.Group();
  private ringCTilt = new THREE.Group();
  private shell: THREE.InstancedMesh;
  private petalBase: THREE.Matrix4[] = [];
  private petalDir: THREE.Vector3[] = [];
  private crownMeshes: { mesh: THREE.InstancedMesh; locals: THREE.Matrix4[] }[] = [];
  private injectorMeshes: { mesh: THREE.InstancedMesh; radius: number }[] = [];
  private lastExplode = -1;
  private m = new THREE.Matrix4();
  private m2 = new THREE.Matrix4();
  private q = new THREE.Quaternion();
  private v = new THREE.Vector3();
  private s = new THREE.Vector3(1, 1, 1);
  readonly coreLight: THREE.PointLight;

  constructor(sphereDetail: number) {
    const g = getGeometries(sphereDetail);
    const mat = getMaterials();
    const part = (id: PartId) => {
      const group = new THREE.Group();
      group.name = id;
      group.userData.part = id;
      this.root.add(group);
      return group;
    };

    // Core, glass, wire cage.
    const coreGroup = part('core');
    const core = new THREE.Mesh(g.core, mat.core);
    coreGroup.add(core);
    const glass = new THREE.Mesh(g.glass, mat.glass);
    glass.raycast = noRaycast;
    glass.renderOrder = 2;
    this.root.add(glass);
    const cage = new THREE.LineSegments(g.cage, mat.cage);
    cage.raycast = noRaycast;
    this.root.add(cage);
    this.coreLight = new THREE.PointLight('#5ff0ff', 4, 6, 1.6);
    this.root.add(this.coreLight);

    // Gyroscopic rings: three nested gimbals on different axes.
    const rings = part('rings');
    this.ringATilt.add(this.ringA);
    this.ringBTilt.add(this.ringB);
    this.ringCTilt.add(this.ringC);
    this.ringBTilt.rotation.set(0, 0, 0.5);
    this.ringCTilt.rotation.set(0.35, 0, -0.2);
    rings.add(this.ringATilt, this.ringBTilt, this.ringCTilt);
    this.ringA.add(new THREE.Mesh(g.ringA, mat.rings));
    this.ringB.add(new THREE.Mesh(g.ringB, mat.rings));
    this.ringC.add(new THREE.Mesh(g.ringC, mat.rings));
    const ringLight = new THREE.Mesh(g.ringLight, mat.coreLight);
    ringLight.raycast = noRaycast;
    this.ringC.add(ringLight);
    const teeth = new THREE.InstancedMesh(g.tooth, mat.rings, 72);
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2;
      this.m.makeRotationY(-a).setPosition(Math.cos(a) * 1.205, 0, Math.sin(a) * 1.205);
      teeth.setMatrixAt(i, this.m);
    }
    this.ringB.add(teeth);
    const pivots = new THREE.InstancedMesh(g.pivot, mat.crown, 2);
    for (let i = 0; i < 2; i++) {
      this.m.makeRotationZ(Math.PI / 2).setPosition(i ? -1.42 : 1.42, 0, 0);
      pivots.setMatrixAt(i, this.m);
    }
    this.ringATilt.add(pivots);
    // One orange indicator on the outer ring.
    const indicator = new THREE.Mesh(g.bolt, mat.orangeLight);
    indicator.position.set(0, 0, 1.37);
    indicator.rotation.x = Math.PI / 2;
    indicator.scale.setScalar(0.9);
    this.ringA.add(indicator);

    // Segmented shell: 12 petals, one instanced draw.
    const shellGroup = part('shell');
    this.shell = new THREE.InstancedMesh(g.petal, mat.shell, UPPER_PETALS * 2);
    const thMid = (SHELL.th0 + SHELL.th1) / 2;
    for (let i = 0; i < UPPER_PETALS * 2; i++) {
      const lower = i >= UPPER_PETALS;
      const phi = (i % UPPER_PETALS) * ((Math.PI * 2) / UPPER_PETALS) + (lower ? Math.PI / UPPER_PETALS : 0);
      const base = new THREE.Matrix4().makeRotationY(phi);
      if (lower) base.multiply(new THREE.Matrix4().makeRotationX(Math.PI));
      this.petalBase.push(base);
      this.petalDir.push(new THREE.Vector3(0, Math.cos(thMid), Math.sin(thMid)).applyMatrix4(base).normalize());
    }
    shellGroup.add(this.shell);

    // Polar crowns: every sub-part is instanced across top and bottom.
    const crown = part('crown');
    const crownPart = (geo: THREE.BufferGeometry, material: THREE.Material, locals: THREE.Matrix4[]) => {
      const mesh = new THREE.InstancedMesh(geo, material, locals.length * 2);
      crown.add(mesh);
      this.crownMeshes.push({ mesh, locals });
    };
    const at = (x: number, y: number, z: number, rotY = 0) => new THREE.Matrix4().makeRotationY(rotY).setPosition(x, y, z);
    crownPart(g.crownBase, mat.crown, [at(0, 0, 0)]);
    crownPart(g.crownHub, mat.crown, [at(0, 0.16, 0)]);
    crownPart(g.crownCap, mat.coreLight, [at(0, 0.285, 0)]);
    crownPart(g.spindle, mat.rings, [at(0, -0.37, 0)]);
    crownPart(
      g.crownFin,
      mat.crown,
      Array.from({ length: FIN_COUNT }, (_, i) => {
        const a = (i / FIN_COUNT) * Math.PI * 2;
        return at(Math.sin(a) * 0.52, 0.11, Math.cos(a) * 0.52, a);
      }),
    );
    crownPart(
      g.bolt,
      mat.injectors,
      Array.from({ length: BOLT_COUNT }, (_, i) => {
        const a = ((i + 0.5) / BOLT_COUNT) * Math.PI * 2;
        return at(Math.sin(a) * 0.6, 0.075, Math.cos(a) * 0.6);
      }),
    );

    // Radial injectors through the equatorial gap.
    const injectors = part('injectors');
    const injPart = (geo: THREE.BufferGeometry, material: THREE.Material, radius: number) => {
      const mesh = new THREE.InstancedMesh(geo, material, INJECTOR_ANGLES.length);
      injectors.add(mesh);
      this.injectorMeshes.push({ mesh, radius });
    };
    injPart(g.injHousing, mat.injectors, INJECTOR_RADIUS);
    injPart(g.injCollar, mat.crown, 1.76);
    injPart(g.injLight, mat.orangeLight, 1.76);
    injPart(g.injRod, mat.rings, 1.66);
    injPart(g.injNozzle, mat.injectors, 1.34);

    // Instance bounds change with the explode factor; the whole object is
    // always on screen, so culling would only cost bounding updates.
    this.root.traverse((o) => {
      if (o instanceof THREE.InstancedMesh) o.frustumCulled = false;
    });

    this.anchors = {
      core: new THREE.Vector3(),
      rings: new THREE.Vector3(),
      shell: new THREE.Vector3(),
      injectors: new THREE.Vector3(),
      crown: new THREE.Vector3(),
    };
    this.anchorNormals = {
      core: new THREE.Vector3(0, 0.3, 1).normalize(),
      rings: new THREE.Vector3(1, 0, 0),
      shell: this.petalDir[0].clone(),
      injectors: new THREE.Vector3(Math.sin(INJECTOR_ANGLES[0]), 0, Math.cos(INJECTOR_ANGLES[0])),
      crown: new THREE.Vector3(0, 1, 0),
    };
    this.setExplode(0);
  }

  /** Writes all instance matrices for an explode factor 0..1. */
  setExplode(e: number) {
    if (Math.abs(e - this.lastExplode) < 1e-4) return;
    this.lastExplode = e;
    const { m, m2, q, v, s } = this;

    // Petals slide out along their normal and tilt open.
    for (let i = 0; i < this.petalBase.length; i++) {
      m.makeTranslation(this.petalDir[i].x * e * 1.3, this.petalDir[i].y * e * 1.3, this.petalDir[i].z * e * 1.3);
      m.multiply(this.petalBase[i]);
      m.multiply(m2.makeRotationX(-0.3 * e));
      this.shell.setMatrixAt(i, m);
    }
    this.shell.instanceMatrix.needsUpdate = true;

    // Crowns lift off along the axis.
    const lift = CROWN_Y + e * 1.45;
    for (const { mesh, locals } of this.crownMeshes) {
      for (let side = 0; side < 2; side++) {
        m.makeTranslation(0, side ? -lift : lift, 0);
        if (side) m.multiply(m2.makeRotationX(Math.PI));
        for (let k = 0; k < locals.length; k++) {
          m2.copy(m).multiply(locals[k]);
          mesh.setMatrixAt(side * locals.length + k, m2);
        }
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Injectors retract radially.
    for (const { mesh, radius } of this.injectorMeshes) {
      for (let i = 0; i < INJECTOR_ANGLES.length; i++) {
        const a = INJECTOR_ANGLES[i];
        v.set(Math.sin(a), 0, Math.cos(a));
        q.setFromUnitVectors(Y, v);
        v.multiplyScalar(radius + e * 1.35);
        m.compose(v, q, s);
        mesh.setMatrixAt(i, m);
      }
      mesh.instanceMatrix.needsUpdate = true;
    }

    // Rings fan out vertically so each one reads on its own.
    this.ringATilt.position.y = e * 0.85;
    this.ringCTilt.position.y = -e * 0.85;

    // Hotspot anchors in root space.
    this.anchors.core.set(0, 0.3, 1).normalize().multiplyScalar(0.58);
    this.anchors.rings.set(1.5, e * 0.85, 0);
    this.anchors.shell.copy(this.petalDir[0]).multiplyScalar(SHELL.rOut + e * 1.3);
    const a0 = INJECTOR_ANGLES[0];
    this.anchors.injectors.set(Math.sin(a0), 0, Math.cos(a0)).multiplyScalar(INJECTOR_RADIUS + 0.3 + e * 1.35);
    this.anchors.crown.set(0, lift + 0.32, 0);
  }

  /** Spins the gimbals. `speed` comes from the timeline. */
  spin(dt: number, speed: number) {
    this.ringA.rotation.x += dt * speed * 0.55;
    this.ringB.rotation.y += dt * speed * 0.9;
    this.ringBTilt.rotation.x += dt * speed * 0.12;
    this.ringC.rotation.y -= dt * speed * 1.5;
  }
}
