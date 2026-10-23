// Horloge commune : le temps de la scène est dérivé de l'horloge de l'AudioContext.
// Les notes sont programmées à l'avance sur cette horloge (précision à l'échantillon) et
// l'image affiche l'instant réellement entendu (latence de sortie comprise).

import { createOutput, playNote } from './synth.js';

const LOOKAHEAD = 0.3;
const START_DELAY = 0.08;

export class Transport {
  constructor() {
    this.ctx = null;
    this.out = null;
    this.events = [];
    this.duration = 0;
    this.instrument = 'xylophone';
    this.volume = 0.8;
    this.offsetMs = 0; // réglage manuel (casque Bluetooth, etc.)
    this.playing = false;
    this.position = 0;
    this.session = null;
    this.onEnded = null;
    this.timer = null;
  }

  ensureContext() {
    if (!this.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AC({ latencyHint: 'interactive' });
      this.out = createOutput(this.ctx, this.ctx.destination, { volume: this.volume });
      if (navigator.audioSession) navigator.audioSession.type = 'playback'; // iOS : ignore le mode silencieux
    }
    return this.ctx;
  }

  setVolume(v) {
    this.volume = v;
    this.out?.setVolume(v);
  }

  setTrack(events, duration, keepPosition = false) {
    const wasPlaying = this.playing;
    const ratio = this.duration ? this.time / this.duration : 0;
    this.stopSession();
    this.events = events;
    this.duration = duration;
    this.position = keepPosition ? ratio * duration : 0;
    if (wasPlaying) this.startSession(this.position);
  }

  // Instant de l'horloge audio qui sort actuellement des haut-parleurs.
  heardContextTime() {
    const ctx = this.ctx;
    if (ctx.getOutputTimestamp) {
      const ts = ctx.getOutputTimestamp();
      if (ts.contextTime > 0 && ts.performanceTime > 0) {
        return ts.contextTime + Math.min(0.05, Math.max(0, (performance.now() - ts.performanceTime) / 1000));
      }
    }
    return ctx.currentTime - (ctx.outputLatency || ctx.baseLatency || 0);
  }

  get time() {
    if (!this.playing || !this.session) return this.position;
    const t = this.heardContextTime() - this.session.origin - this.offsetMs / 1000;
    return Math.min(this.duration, Math.max(this.session.from, t));
  }

  get latencyMs() {
    if (!this.ctx) return 0;
    return ((this.ctx.outputLatency || 0) + (this.ctx.baseLatency || 0)) * 1000;
  }

  async play() {
    const ctx = this.ensureContext();
    if (ctx.state !== 'running') await ctx.resume();
    if (this.position >= this.duration - 0.01) this.position = 0;
    this.startSession(this.position);
  }

  pause() {
    if (!this.playing) return;
    this.position = this.time;
    this.stopSession();
  }

  seek(t) {
    const wasPlaying = this.playing;
    this.stopSession();
    this.position = Math.max(0, Math.min(this.duration, t));
    if (wasPlaying) this.startSession(this.position);
  }

  restart() {
    this.seek(0);
  }

  startSession(from) {
    const ctx = this.ctx;
    const bus = ctx.createGain();
    bus.connect(this.out.input);
    let next = 0;
    while (next < this.events.length && this.events[next].t < from - 1e-4) next++;
    this.session = { origin: ctx.currentTime + START_DELAY - from, from, bus, next };
    this.playing = true;
    this.schedule();
    clearInterval(this.timer);
    this.timer = setInterval(() => this.schedule(), 25);
  }

  stopSession() {
    clearInterval(this.timer);
    this.timer = null;
    const s = this.session;
    if (s) {
      const now = this.ctx.currentTime;
      s.bus.gain.setTargetAtTime(0, now, 0.015);
      setTimeout(() => s.bus.disconnect(), 300);
    }
    this.session = null;
    this.playing = false;
  }

  schedule() {
    const s = this.session;
    if (!s) return;
    const ctx = this.ctx;
    const horizon = ctx.currentTime + (document.hidden ? 1.5 : LOOKAHEAD);
    while (s.next < this.events.length && s.origin + this.events[s.next].t < horizon) {
      const e = this.events[s.next++];
      const when = s.origin + e.t;
      // Une note en retard (onglet gelé) est sautée plutôt que jouée à contretemps.
      if (when >= ctx.currentTime - 0.01) playNote(ctx, s.bus, this.instrument, Math.max(when, ctx.currentTime), e);
    }
    if (this.time >= this.duration) {
      this.position = this.duration;
      this.stopSession();
      this.onEnded?.();
    }
  }

  // Flux audio pour MediaRecorder (même graphe que les haut-parleurs).
  captureStream() {
    const ctx = this.ensureContext();
    const dest = ctx.createMediaStreamDestination();
    this.out.master.connect(dest);
    return { stream: dest.stream, release: () => this.out.master.disconnect(dest) };
  }
}
