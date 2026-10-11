/**
 * Scroll-driven timeline. The scene state is a pure function of the timeline
 * position (0..5, one unit per sequence), so scrolling backwards or reversing
 * direction mid-way always lands on a coherent pose.
 *
 * Every channel is a monotone cubic spline (Fritsch–Carlson): continuous
 * velocity across keys, no overshoot on plateaus.
 */

type Key = readonly [number, number];

class Track {
  private xs: Float64Array;
  private ys: Float64Array;
  private ms: Float64Array;

  constructor(keys: readonly Key[]) {
    const n = keys.length;
    this.xs = new Float64Array(keys.map((k) => k[0]));
    this.ys = new Float64Array(keys.map((k) => k[1]));
    this.ms = new Float64Array(n);
    if (n < 2) return;
    const d = new Float64Array(n - 1);
    for (let i = 0; i < n - 1; i++) d[i] = (this.ys[i + 1] - this.ys[i]) / (this.xs[i + 1] - this.xs[i]);
    this.ms[0] = 0;
    this.ms[n - 1] = 0;
    for (let i = 1; i < n - 1; i++) this.ms[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
    for (let i = 0; i < n - 1; i++) {
      if (d[i] === 0) {
        this.ms[i] = 0;
        this.ms[i + 1] = 0;
        continue;
      }
      const a = this.ms[i] / d[i];
      const b = this.ms[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        this.ms[i] = tau * a * d[i];
        this.ms[i + 1] = tau * b * d[i];
      }
    }
  }

  eval(t: number) {
    const { xs, ys, ms } = this;
    const n = xs.length;
    if (t <= xs[0]) return ys[0];
    if (t >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (i < n - 2 && t > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const u = (t - xs[i]) / h;
    const u2 = u * u;
    const u3 = u2 * u;
    return (
      (2 * u3 - 3 * u2 + 1) * ys[i] +
      (u3 - 2 * u2 + u) * h * ms[i] +
      (-2 * u3 + 3 * u2) * ys[i + 1] +
      (u3 - u2) * h * ms[i + 1]
    );
  }
}

const TRACKS = {
  // Camera, spherical around the object.
  camR: new Track([[0, 12.6], [0.5, 11.4], [1.0, 10.6], [1.35, 9.4], [1.7, 9.6], [2.0, 11.8], [2.3, 15.2], [2.65, 15.6], [3.0, 12.6], [3.3, 10.6], [3.65, 9.9], [4.0, 10.6], [4.45, 11.6], [5, 12.0]]),
  camAz: new Track([[0, -0.5], [0.5, -0.25], [1.0, 0.35], [1.35, 1.45], [1.7, 2.75], [2.0, 3.7], [2.3, 4.25], [2.65, 4.6], [3.0, 5.5], [3.3, 6.05], [3.65, 6.4], [4.0, 6.65], [4.45, 6.95], [5, 7.2]]),
  camEl: new Track([[0, 0.05], [0.5, 0.14], [1.0, 0.2], [1.35, 0.1], [1.7, -0.2], [2.0, 0.3], [2.3, 0.42], [2.65, 0.3], [3.0, 0.15], [3.3, 0.08], [3.65, 0.05], [4.0, 0.0], [4.45, -0.13], [5, -0.1]]),
  // Screen-space framing (fraction of the half viewport): pushes the object
  // away from the text column without changing perspective.
  shiftX: new Track([[0, 0.3], [0.5, 0.28], [1.0, 0.24], [2.0, 0.22], [2.65, 0.2], [3.0, 0.22], [3.65, 0.24], [4.0, 0.12], [4.45, 0.0], [5, 0.0]]),
  shiftY: new Track([[0, 0.04], [0.5, 0.0], [3.65, 0.0], [4.45, 0.24], [5, 0.26]]),
  // Object.
  yaw: new Track([[0, 0], [4.0, 0], [5, 0.7]]),
  lift: new Track([[0, -0.2], [0.5, 0], [5, 0]]),
  explode: new Track([[0, 0], [2.0, 0], [2.3, 1], [2.7, 1], [3.05, 0.35], [3.3, 0], [5, 0]]),
  // Energy.
  glow: new Track([[0, 0.55], [1, 0.6], [2.0, 0.5], [2.7, 0.35], [3.25, 0.4], [3.45, 0.85], [3.65, 1.1], [4.4, 1.0], [5, 1.2]]),
  wave: new Track([[0, 0], [3.3, 0], [3.62, 1], [5, 1]]),
  charge: new Track([[0, 0], [3.05, 0], [3.3, 0.18], [3.62, 1], [5, 1]]),
  light: new Track([[0, 0.6], [1, 1], [2.0, 1], [2.7, 0.9], [3.3, 0.75], [3.65, 1.05], [5, 1.05]]),
  ringSpin: new Track([[0, 0.25], [1, 0.35], [2, 0.2], [2.7, 0.12], [3.25, 0.6], [3.6, 2.4], [4.3, 1.4], [5, 1.6]]),
  halo: new Track([[0, 0], [4.0, 0], [4.55, 1], [5, 1]]),
};

export type Channel = keyof typeof TRACKS;
export type Pose = Record<Channel, number>;

const CHANNELS = Object.keys(TRACKS) as Channel[];

export function createPose(): Pose {
  const p = {} as Pose;
  for (const c of CHANNELS) p[c] = 0;
  return p;
}

export function sampleChannel(c: Channel, t: number) {
  return TRACKS[c].eval(t);
}

/** Writes the pose for timeline position `t` into `out` (no allocation). */
export function samplePose(t: number, out: Pose) {
  for (let i = 0; i < CHANNELS.length; i++) {
    const c = CHANNELS[i];
    out[c] = TRACKS[c].eval(t);
  }
  return out;
}

export const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
export const smoothstep = (a: number, b: number, x: number) => {
  const u = clamp01((x - a) / (b - a));
  return u * u * (3 - 2 * u);
};
/** Frame-rate independent exponential damping. */
export const damp = (current: number, target: number, lambda: number, dt: number) =>
  current + (target - current) * (1 - Math.exp(-lambda * dt));
