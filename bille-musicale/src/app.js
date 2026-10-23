import { demoProject, noteName, LIBRARY, libraryProject } from './melody.js';
import { parseMidi, extractParts, suggestMelodyPart, toMonophonic, trimMelody, firstTempoBpm } from './midi.js';
import { buildScene, normalizeSettings, restyleScene, laneMix } from './scene.js';
import { lastImpactIndex } from './planner.js';
import { Renderer } from './renderer.js';
import { Transport } from './transport.js';
import { INSTRUMENTS, renderOffline, encodeWav } from './synth.js';
import { PALETTES, COLOR_MODES } from './palettes.js';
import { measureAttacks } from './verify.js';
import { transcribe, decodeAudioFile, excerpt, loudness } from './transcribe.js';
import { pickRecorderFormat, startRecording, download, hosted, canSave } from './recorder.js';

const $ = (id) => document.getElementById(id);
const canvas = $('view');
const renderer = new Renderer(canvas);

const fmtTime = (t) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (s) =>
  (s || 'bille-musicale')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();

function monoMix(buffer) {
  const a = buffer.getChannelData(0);
  const b = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : a;
  const out = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) out[i] = (a[i] + b[i]) / 2;
  return out;
}

// Piste complète (mélodie + batterie), telle qu'elle est entendue et exportée.
function renderTrack(scene, sampleRate = 48000) {
  return renderOffline([...scene.events, ...scene.beat], scene.duration, {
    instrument: scene.settings.instrument,
    volume: scene.settings.volume,
    mix: scene.mix,
    sampleRate,
  });
}

// Vérification de la synchronisation : la mélodie seule est rendue, pour que chaque attaque
// mesurée soit bien celle d'une note (et non un coup de batterie).
// Le piano feutré monte trop doucement pour qu'on repère ses attaques dans un accord : il est
// contrôlé avec le piano classique, qui suit exactement la même programmation des notes.
async function checkSync(scene, sampleRate = 48000) {
  const buffer = await renderOffline(scene.events, scene.duration, {
    instrument: scene.settings.instrument === 'softpiano' ? 'piano' : scene.settings.instrument,
    volume: scene.settings.volume,
    sampleRate,
  });
  const times = [...new Set(scene.events.map((e) => e.t))];
  return measureAttacks(monoMix(buffer), sampleRate, times);
}

function toBase64(bytes) {
  let s = '';
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function projectFile(project, settings) {
  return {
    format: 'bille-musicale',
    version: 1,
    title: project.title,
    bpm: project.bpm ?? null,
    notes: project.notes.map((n) => ({
      time: +n.time.toFixed(6),
      midi: n.midi,
      duration: +(n.duration ?? 0.3).toFixed(6),
      velocity: +(n.velocity ?? 0.8).toFixed(3),
    })),
    parts: project.parts?.map((p) => ({ name: p.name, notes: p.notes })) ?? null,
    beat: project.beat ?? null,
    settings,
  };
}

function readProject(json) {
  if (json.format !== 'bille-musicale' || !Array.isArray(json.notes)) throw new Error('Ce fichier .json n’est pas un projet Bille musicale.');
  return {
    project: { title: json.title || 'Sans titre', bpm: json.bpm || null, notes: json.notes, parts: json.parts || undefined, beat: json.beat || null },
    settings: json.settings,
  };
}

// ---------------------------------------------------------------------------
// Mode rendu : piloté par tools/export-mp4.mjs (Playwright) pour l'export image par image.

function setupRenderMode() {
  document.body.classList.add('render-mode');
  canvas.width = 1080;
  canvas.height = 1920;
  let scene = null;
  window.billeRender = {
    // `width` : 1080 (Full HD), 1440 (2K) ou 2160 (4K) ; le dessin étant vectoriel, il reste net.
    setup(file, width = 1080) {
      canvas.width = width;
      canvas.height = Math.round((width * 16) / 9);
      const { project, settings } = file ? readProject(file) : { project: demoProject(), settings: undefined };
      scene = buildScene(project, settings);
      return {
        title: scene.title,
        duration: scene.duration,
        notes: scene.events.length,
        verification: scene.verification,
      };
    },
    frames(start, count, fps, quality = 0.96) {
      const out = [];
      for (let i = 0; i < count; i++) {
        renderer.draw(scene, (start + i) / fps);
        out.push(canvas.toDataURL('image/jpeg', quality).slice(23));
      }
      return out;
    },
    async audio(sampleRate = 48000) {
      const buffer = await renderTrack(scene, sampleRate);
      return { wav: toBase64(encodeWav(buffer)), sync: await checkSync(scene, sampleRate) };
    },
  };
  window.billeReady = true;
}

// ---------------------------------------------------------------------------
// Application interactive.

function setupApp() {
  const transport = new Transport();
  const STORAGE = 'bille-musicale:settings';
  let stored = {};
  try {
    stored = JSON.parse(localStorage.getItem(STORAGE) || '{}');
  } catch {}
  const state = {
    project: demoProject(),
    settings: normalizeSettings(stored),
    scene: null,
    midi: null, // { name, bpm, parts }
    dirty: true,
    seeking: false,
    recording: false,
    immersive: false,
    screenRec: false,
  };
  const endedListeners = new Set();
  transport.onEnded = () => {
    updatePlayState();
    endedListeners.forEach((f) => f());
  };

  const saveSettings = () => {
    try {
      localStorage.setItem(STORAGE, JSON.stringify(state.settings));
    } catch {}
  };

  let toastTimer;
  function toast(msg, ms = 3500) {
    const el = $('toast');
    el.textContent = msg;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), ms);
  }

  // --- Construction de la scène -------------------------------------------
  function rebuild(keepPosition = false) {
    const t0 = performance.now();
    state.scene = buildScene(state.project, state.settings);
    applyAudioSettings();
    const track = [...state.scene.events, ...state.scene.beat].sort((a, b) => a.t - b.t);
    transport.setTrack(track, state.scene.duration, keepPosition);
    $('drumsField').hidden = !state.project.beat;
    $('lane2VolumeField').hidden = state.scene.lanes.length < 2;
    state.dirty = true;
    applyStageColor();
    renderReport(performance.now() - t0);
    $('audioReport').innerHTML = '';
    updateTempoLabel();
    updateMelodyInfo();
  }

  function restyle() {
    state.scene = restyleScene(state.scene, state.settings);
    state.dirty = true;
    applyStageColor();
    saveSettings();
  }

  // Les bandes autour de la scène 9:16 (plein écran) prennent la couleur du fond.
  function applyStageColor() {
    document.documentElement.style.setProperty('--stage-bg', state.scene.settings.colors.bgBottom);
  }

  function applyAudioSettings() {
    transport.instrument = state.settings.instrument;
    transport.mix = state.scene ? laneMix(state.settings, state.scene.lanes.length) : null;
    transport.setVolume(state.settings.volume);
    transport.offsetMs = state.settings.audioOffsetMs;
  }

  function renderReport(ms) {
    const v = state.scene.verification;
    const ok = (b) => (b ? '<span class="ok">✓</span>' : '<span class="ko">✗</span>');
    $('courseReport').innerHTML = [
      `${ok(v.maxTimeErrorMs < 1e-3)} ${v.count} impacts aux horaires exacts des notes (écart max ${v.maxTimeErrorMs.toFixed(3)} ms)`,
      `${ok(v.maxContactErrorPx < 0.01)} Contact bille-plateforme exact (erreur max ${v.maxContactErrorPx.toExponential(1)} px)`,
      `${ok(v.collisions === 0)} ${v.collisions} collision parasite · ${ok(v.wrongSide === 0)} rebonds du bon côté`,
      `<span style="color:var(--muted)">Parcours calculé en ${ms.toFixed(0)} ms</span>`,
    ].join('<br>');
  }

  function updateMelodyInfo() {
    const lanes = state.project.parts?.length || 1;
    const n = state.scene.verification.count;
    const d = state.scene.duration;
    const origin = state.midi
      ? `MIDI « ${state.midi.name} »`
      : state.audio
        ? `Son « ${state.audio.name} »`
        : `Mélodie « ${state.project.title} »`;
    $('melodyInfo').textContent = `${origin} · ${lanes > 1 ? `${lanes} billes · ` : ''}${n} notes · ${fmtTime(d)}${state.dropped ? ` · ${state.dropped} notes d’accord ou trop rapprochées retirées` : ''}`;
  }

  function updateTempoLabel() {
    const pct = Math.round(state.settings.tempo * 100);
    const bpm = state.scene?.bpm;
    $('tempoLabel').textContent = `${pct} %${bpm ? ` · ${Math.round(bpm)} BPM` : ''}`;
  }

  // --- Boucle d'affichage ---------------------------------------------------
  function resizeCanvas() {
    if (state.recording) {
      const w = Number($('recordSize').value) || 1080;
      canvas.width = w;
      canvas.height = Math.round((w * 16) / 9);
    } else {
      // En plein écran, la scène occupe tout l'écran (cadre 9:16 centré, un peu plus de parcours
      // visible au-dessus et au-dessous) ; résolution plafonnée à celle de l'export.
      const rect = $('stage').getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 3);
      const scale = Math.min(dpr, 1080 / Math.min(rect.width, (rect.height * 9) / 16));
      canvas.width = Math.max(90, Math.round(rect.width * scale));
      canvas.height = Math.max(160, Math.round(rect.height * scale));
    }
    state.dirty = true;
  }
  new ResizeObserver(resizeCanvas).observe($('stage'));

  function frame() {
    const t = transport.time;
    if (transport.playing || state.dirty || state.recording) {
      renderer.draw(state.scene, t);
      state.dirty = false;
      updateTimeUI(t);
      if (!$('hud').hidden) updateHud(t);
    }
    requestAnimationFrame(frame);
  }

  function updateTimeUI(t) {
    const d = state.scene.duration;
    $('time').textContent = `${fmtTime(t)} / ${fmtTime(d)}`;
    if (!state.seeking) $('seek').value = String(Math.round((t / d) * 1000));
  }

  function updateHud(t) {
    const course = state.scene.course;
    const i = lastImpactIndex(course, t);
    const imp = course.impacts[i];
    const next = course.impacts[i + 1];
    $('hud').textContent = [
      `t = ${t.toFixed(3)} s   impact ${i + 1}/${course.impacts.length}${imp ? ` (${noteName(imp.midi)} à ${imp.t.toFixed(3)} s)` : ''}`,
      next ? `prochain : ${noteName(next.midi)} dans ${((next.t - t) * 1000).toFixed(0)} ms` : 'fin de la mélodie',
      `latence de sortie compensée : ${transport.latencyMs.toFixed(0)} ms · décalage manuel ${transport.offsetMs} ms`,
    ].join('\n');
  }

  function updatePlayState() {
    document.body.classList.toggle('playing', transport.playing);
    $('playLabel').textContent = transport.playing ? 'Pause' : 'Lecture';
    state.dirty = true;
  }

  // --- Transport ------------------------------------------------------------
  async function togglePlay() {
    if (state.recording) return;
    if (transport.playing) transport.pause();
    else await transport.play();
    updatePlayState();
  }

  $('btnPlay').onclick = togglePlay;
  $('overlayPlay').onclick = togglePlay;
  $('btnRestart').onclick = async () => {
    if (state.recording) return;
    transport.restart();
    if (!transport.playing) await transport.play();
    updatePlayState();
  };
  $('seek').addEventListener('input', () => {
    state.seeking = true;
    transport.seek((Number($('seek').value) / 1000) * state.scene.duration);
    state.dirty = true;
  });
  $('seek').addEventListener('change', () => (state.seeking = false));

  // --- Plein écran ----------------------------------------------------------
  async function enterImmersive({ hint = true } = {}) {
    state.immersive = true;
    document.body.classList.add('immersive');
    const el = document.documentElement;
    const request = el.requestFullscreen || el.webkitRequestFullscreen;
    if (request && !document.fullscreenElement) {
      try {
        await request.call(el, { navigationUI: 'hide' });
      } catch {}
    }
    if (hint) {
      $('exitHint').classList.add('show');
      setTimeout(() => $('exitHint').classList.remove('show'), 1600);
    }
    resizeCanvas();
  }

  function exitImmersive() {
    if (!state.immersive) return;
    state.immersive = false;
    state.screenRec = false;
    document.body.classList.remove('immersive');
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
    resizeCanvas();
  }

  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement && state.immersive) exitImmersive();
  });
  $('stage').addEventListener('dblclick', () => state.immersive && exitImmersive());

  $('btnFull').onclick = async () => {
    await enterImmersive();
    if (!transport.playing) {
      await transport.play();
      updatePlayState();
    }
  };

  $('btnScreenRec').onclick = async () => {
    transport.ensureContext(); // dans le geste utilisateur (iOS)
    transport.pause();
    transport.seek(0);
    updatePlayState();
    state.screenRec = true;
    await enterImmersive({ hint: false });
    await wait(2000);
    if (!state.screenRec) return;
    await transport.play();
    updatePlayState();
  };
  endedListeners.add(async () => {
    if (!state.screenRec) return;
    await wait(1200);
    exitImmersive();
  });

  document.addEventListener('keydown', (e) => {
    if (e.target.closest('input, select, textarea')) return;
    if (e.code === 'Space') {
      e.preventDefault();
      togglePlay();
    } else if (e.key === 'r' || e.key === 'R') $('btnRestart').click();
    else if (e.key === 'f' || e.key === 'F') state.immersive ? exitImmersive() : $('btnFull').click();
    else if (e.key === 'Escape') exitImmersive();
  });

  // --- Mélodie : démo, MIDI, son, projet ------------------------------------
  // Une seule source à la fois : la démo, une piste MIDI, ou la mélodie retrouvée dans un son.
  function setSource(kind) {
    if (kind !== 'midi') state.midi = null;
    if (kind !== 'audio') state.audio = null;
    state.dropped = 0;
    $('sourceOptions').hidden = kind !== 'midi' && kind !== 'audio';
    $('trackField').hidden = kind !== 'midi';
    $('track2Field').hidden = kind !== 'midi';
    $('audioModeField').hidden = kind !== 'audio';
    $('removeVoiceField').hidden = kind !== 'audio';
    $('audioHint').hidden = kind !== 'audio';
    if (kind !== 'library') $('library').value = '';
  }

  function passage() {
    return {
      start: Math.max(0, Number($('startAt').value) || 0),
      duration: Math.max(5, Number($('maxDuration').value) || 60),
      minGap: Math.max(0.03, Number($('minGap').value) / 1000 || 0.07),
    };
  }

  function applySource() {
    if (state.midi) applyMidiPart();
    else if (state.audio) analyzeAudio();
  }

  for (const m of LIBRARY) $('library').append(new Option(`${m.title} (${m.bpm} BPM)`, m.id));
  $('library').addEventListener('change', (e) => {
    if (!e.target.value) return;
    setSource('library');
    state.project = libraryProject(e.target.value);
    rebuild();
  });

  $('fileInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      if (/\.json$/i.test(file.name)) {
        const { project, settings } = readProject(JSON.parse(await file.text()));
        setSource('project');
        state.project = project;
        if (settings) state.settings = normalizeSettings(settings);
        syncControls();
        rebuild();
        toast(`Projet « ${project.title} » chargé`);
        return;
      }
      const midi = parseMidi(await file.arrayBuffer());
      const parts = extractParts(midi).filter((p) => p.notes.length);
      if (!parts.length) throw new Error('Ce fichier MIDI ne contient aucune note.');
      setSource('midi');
      state.midi = { name: file.name.replace(/\.midi?$/i, ''), bpm: firstTempoBpm(midi), parts };
      const suggested = suggestMelodyPart(parts);
      const select = $('trackSelect');
      select.innerHTML = '';
      for (const p of parts) {
        const s = p.stats;
        const opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = `${p.name} — ${p.instrument}, canal ${p.channel + 1} · ${s.count} notes · ${noteName(s.min)}–${noteName(s.max)}${s.polyphony > 0.05 ? ` · accords ${Math.round(s.polyphony * 100)} %` : ''}${p === suggested ? ' ★' : ''}`;
        select.append(opt);
      }
      select.value = suggested.id;
      // Deuxième bille : proposée d'office quand le fichier a exactement deux parties (deux mains).
      const second = $('track2Select');
      second.innerHTML = '';
      second.append(new Option('Aucune (une seule bille)', ''));
      for (const opt of select.options) second.append(new Option(opt.textContent.replace(' ★', ''), opt.value));
      const melodic = parts.filter((p) => !p.isDrums);
      second.value = melodic.length === 2 ? melodic.find((p) => p !== suggested).id : '';
      $('startAt').value = '0';
      applyMidiPart();
      toast(`« ${state.midi.name} » : ${parts.length} piste(s). La piste ★ semble porter la mélodie.`);
    } catch (err) {
      console.error(err);
      toast(err.message || 'Impossible de lire ce fichier.');
    }
  });

  function applyMidiPart() {
    const part = state.midi.parts.find((p) => p.id === $('trackSelect').value);
    const part2 = state.midi.parts.find((p) => p.id === $('track2Select').value && p !== part);
    const { start, duration, minGap } = passage();
    const mono = toMonophonic(part.notes, { minGap });
    // La deuxième bille garde ses accords : un impact joue toutes les notes frappées ensemble.
    const mono2 = part2 ? toMonophonic(part2.notes, { minGap, chords: true }) : null;
    // Les deux pistes sont recalées sur la même origine pour rester ensemble.
    const firstFrom = (notes) => notes.find((n) => n.time >= start - 1e-9)?.time ?? Infinity;
    const offset = Math.min(firstFrom(mono.notes), mono2 ? firstFrom(mono2.notes) : Infinity);
    if (!Number.isFinite(offset)) {
      toast('Aucune note dans ce passage : choisissez un début plus tôt.');
      return;
    }
    const notes = trimMelody(mono.notes, duration, start, offset);
    const parts = [{ name: part.name, notes }];
    if (mono2) parts.push({ name: part2.name, notes: trimMelody(mono2.notes, duration, start, offset) });
    const kept = parts.filter((p) => p.notes.length);
    state.dropped = mono.dropped;
    state.project = { title: state.midi.name, bpm: state.midi.bpm, notes: kept[0].notes, parts: kept.length > 1 ? kept : undefined };
    rebuild();
  }

  $('audioInput').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    $('melodyInfo').textContent = `Lecture de « ${file.name} »…`;
    try {
      const audio = await decodeAudioFile(await file.arrayBuffer());
      setSource('audio');
      state.audio = { name: file.name.replace(/\.[^.]+$/, ''), ...audio };
      $('startAt').value = '0';
      toast(`« ${state.audio.name} » : ${fmtTime(audio.duration)} de son. Choisissez le passage avec « Début » et « Durée ».`, 5000);
      analyzeAudio();
    } catch (err) {
      console.error(err);
      updateMelodyInfo();
      toast(err.message || 'Impossible de lire ce son.');
    }
  });

  // L'analyse peut prendre quelques secondes : un nouveau réglage annule celle en cours.
  let analysis = 0;
  async function analyzeAudio() {
    const run = ++analysis;
    const { start, duration, minGap } = passage();
    let clip = excerpt(state.audio, start, duration);
    if (clip.length < state.audio.rate * 0.5) {
      toast(`Ce passage est vide : le son dure ${fmtTime(state.audio.duration)}.`);
      return;
    }
    if ($('removeVoice').checked) {
      const withoutVoice = excerpt(state.audio, start, duration, { removeVoice: true });
      // Un son mono (ou un mixage où tout est au centre) s'annule entièrement.
      if (!state.audio.stereo || loudness(withoutVoice) < 0.05 * loudness(clip)) {
        $('removeVoice').checked = false;
        toast('Impossible d’enlever la voix : ce son est en mono, ou tout y est placé au centre.', 5000);
      } else clip = withoutVoice;
    }
    const label = (p) => ($('melodyInfo').textContent = `Recherche des notes… ${Math.round(p * 100)} %`);
    label(0);
    try {
      const { notes } = await transcribe(clip, state.audio.rate, {
        mode: $('audioMode').value,
        onProgress: (p) => {
          if (run !== analysis) throw new Error('annulée');
          label(p);
        },
      });
      if (run !== analysis) return;
      if (notes.length < 2) {
        updateMelodyInfo();
        toast('Aucune mélodie trouvée dans ce passage. Essayez un autre passage ou l’autre type de son.', 5000);
        return;
      }
      const mono = toMonophonic(notes, { minGap });
      state.dropped = mono.dropped;
      state.project = { title: state.audio.name, bpm: null, notes: trimMelody(mono.notes) };
      rebuild();
    } catch (err) {
      if (err.message === 'annulée') return;
      console.error(err);
      updateMelodyInfo();
      toast(`Analyse impossible : ${err.message}`);
    }
  }

  $('trackSelect').addEventListener('change', applySource);
  $('track2Select').addEventListener('change', applySource);
  $('audioMode').addEventListener('change', applySource);
  $('removeVoice').addEventListener('change', applySource);
  for (const id of ['startAt', 'maxDuration', 'minGap']) $(id).addEventListener('change', applySource);

  // --- Son et tempo ---------------------------------------------------------
  for (const [key, inst] of Object.entries(INSTRUMENTS)) $('instrument').append(new Option(inst.label, key));
  $('instrument').addEventListener('change', (e) => {
    state.settings.instrument = e.target.value;
    applyAudioSettings();
    saveSettings();
  });
  $('lane2Volume').addEventListener('input', (e) => {
    state.settings.lane2Volume = Number(e.target.value);
    $('lane2VolumeLabel').textContent = `${Math.round(state.settings.lane2Volume * 100)} %`;
    state.scene = { ...state.scene, mix: laneMix(state.settings, state.scene.lanes.length) };
    applyAudioSettings();
    saveSettings();
  });
  $('volume').addEventListener('input', (e) => {
    state.settings.volume = Number(e.target.value);
    applyAudioSettings();
    saveSettings();
  });
  $('transpose').addEventListener('change', (e) => {
    state.settings.transpose = Number(e.target.value);
    saveSettings();
    rebuild(true);
  });
  $('tempo').addEventListener('input', (e) => {
    state.settings.tempo = Number(e.target.value) / 100;
    updateTempoLabel();
  });
  $('tempo').addEventListener('change', () => {
    saveSettings();
    rebuild(true);
  });

  // --- Couleurs -------------------------------------------------------------
  for (const [key, p] of Object.entries(PALETTES)) {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'palette';
    b.title = p.label;
    b.dataset.palette = key;
    b.style.background = `linear-gradient(${p.bgTop}, ${p.bgBottom})`;
    b.innerHTML = `<span style="left:6px;background:${p.low}"></span><span style="right:6px;bottom:16px;background:${p.high}"></span>`;
    b.onclick = () => {
      state.settings.palette = key;
      state.settings.colors = { ...p };
      syncControls();
      restyle();
    };
    $('palettes').append(b);
  }
  for (const input of document.querySelectorAll('[data-color]')) {
    input.addEventListener('input', () => {
      state.settings.colors[input.dataset.color] = input.value;
      state.settings.palette = 'custom';
      syncControls();
      restyle();
    });
  }
  for (const [key, label] of Object.entries(COLOR_MODES)) $('colorMode').append(new Option(label, key));
  $('colorMode').addEventListener('change', (e) => {
    state.settings.colorMode = e.target.value;
    restyle();
  });
  $('showTitle').addEventListener('change', (e) => {
    state.settings.showTitle = e.target.checked;
    restyle();
  });
  $('drums').addEventListener('change', (e) => {
    state.settings.drums = e.target.checked;
    saveSettings();
    rebuild(true);
  });
  $('showNoteNames').addEventListener('change', (e) => {
    state.settings.showNoteNames = e.target.checked;
    restyle();
  });

  // --- Synchronisation ------------------------------------------------------
  $('offset').addEventListener('input', (e) => {
    state.settings.audioOffsetMs = Number(e.target.value);
    $('offsetLabel').textContent = `${state.settings.audioOffsetMs} ms`;
    applyAudioSettings();
    saveSettings();
  });
  $('showHud').addEventListener('change', (e) => {
    $('hud').hidden = !e.target.checked;
    state.dirty = true;
  });
  $('btnVerify').onclick = async () => {
    const btn = $('btnVerify');
    btn.disabled = true;
    btn.textContent = 'Rendu du son…';
    try {
      const sync = await checkSync(state.scene);
      const ok = sync.matched === sync.expected && sync.maxErrorMs < 5;
      $('audioReport').innerHTML =
        `<span class="${ok ? 'ok' : 'ko'}">${ok ? '✓' : '✗'}</span> ${sync.matched}/${sync.expected} attaques retrouvées dans le son rendu, ` +
        `écart max ${sync.maxErrorMs.toFixed(1)} ms (moyenne ${sync.meanErrorMs.toFixed(1)} ms)`;
    } catch (err) {
      $('audioReport').textContent = `Vérification impossible : ${err.message}`;
    } finally {
      btn.disabled = false;
      btn.textContent = 'Vérifier le son rendu';
    }
  };

  // --- Vidéo ----------------------------------------------------------------
  const format = pickRecorderFormat();
  $('recordInfo').textContent = format
    ? `Enregistrement en temps réel, fichier ${format.ext.toUpperCase()}${format.ext === 'webm' && !hosted ? ' (conversion MP4 : tools/webm-vers-mp4.sh)' : ''}. Gardez la page au premier plan ; en cas d’à-coups, choisissez 720×1280.`
    : 'Ce navigateur ne permet pas l’enregistrement intégré : utilisez le mode enregistrement d’écran.';
  $('btnRecord').disabled = !format;
  // En ligne (claude.ai), seuls certains formats peuvent être enregistrés : pas de WAV.
  $('btnWav').hidden = hosted;
  canSave().then((ok) => {
    if (ok) return;
    $('btnRecord').disabled = true;
    $('btnProject').hidden = true;
    $('recordInfo').textContent = 'L’enregistrement de fichiers n’est pas disponible ici : utilisez le mode enregistrement d’écran.';
  });

  // La dernière vidéo reste disponible si l'enregistrement du fichier a été refusé ou a échoué.
  let lastVideo = null;
  async function saveVideo() {
    try {
      await download(lastVideo.blob, lastVideo.name);
      toast(`Vidéo enregistrée (${(lastVideo.blob.size / 1e6).toFixed(1)} Mo)`);
    } catch (err) {
      $('btnSaveVideo').hidden = false;
      if (err?.code !== 'declined') toast(`Impossible d’enregistrer la vidéo : ${err.message || err.code}`);
    }
  }
  $('btnSaveVideo').onclick = saveVideo;

  $('btnRecord').onclick = async () => {
    if (state.recording) return;
    const btn = $('btnRecord');
    const ctx = transport.ensureContext();
    await ctx.resume();
    transport.pause();
    transport.seek(0);
    state.recording = true;
    document.body.classList.add('recording');
    resizeCanvas();
    // Pas de cas particulier pour la latence : le flux capté par MediaRecorder est livré au rythme
    // de la sortie audio, donc l'image suit l'instant entendu comme en lecture (mesuré avec
    // tools/verifier-video.mjs : +44 ms de décalage sans compensation, moins d'une image avec).
    const capture = transport.captureStream();
    const rec = startRecording(canvas, capture.stream, format);
    btn.disabled = true;
    const progress = setInterval(() => {
      btn.textContent = `Enregistrement… ${Math.round((transport.time / state.scene.duration) * 100)} %`;
    }, 200);
    try {
      await wait(400);
      const ended = new Promise((resolve) => {
        const f = () => {
          endedListeners.delete(f);
          resolve();
        };
        endedListeners.add(f);
      });
      await transport.play();
      updatePlayState();
      await ended;
      await wait(400);
      const blob = await rec.stop();
      lastVideo = { blob, name: `${slug(state.project.title)}.${format.ext}` };
      saveVideo();
    } catch (err) {
      console.error(err);
      toast(`Enregistrement interrompu : ${err.message}`);
    } finally {
      clearInterval(progress);
      capture.release();
      state.recording = false;
      document.body.classList.remove('recording');
      btn.disabled = false;
      btn.textContent = 'Enregistrer la vidéo avec le son';
      resizeCanvas();
      updatePlayState();
    }
  };

  $('btnWav').onclick = async () => {
    const buffer = await renderTrack(state.scene);
    download(new Blob([encodeWav(buffer)], { type: 'audio/wav' }), `${slug(state.project.title)}.wav`);
  };
  $('btnProject').onclick = () => {
    const json = JSON.stringify(projectFile(state.project, state.settings), null, 1);
    download(new Blob([json], { type: 'application/json' }), `${slug(state.project.title)}.json`).catch((err) => {
      if (err?.code !== 'declined') toast(`Impossible d’enregistrer le projet : ${err.message || err.code}`);
    });
  };

  // --- Contrôles ↔ réglages -------------------------------------------------
  function syncControls() {
    const s = state.settings;
    $('instrument').value = s.instrument;
    $('transpose').value = String(s.transpose);
    $('volume').value = String(s.volume);
    $('lane2Volume').value = String(s.lane2Volume);
    $('lane2VolumeLabel').textContent = `${Math.round(s.lane2Volume * 100)} %`;
    $('tempo').value = String(Math.round(s.tempo * 100));
    $('colorMode').value = s.colorMode;
    $('showTitle').checked = s.showTitle;
    $('showNoteNames').checked = s.showNoteNames;
    $('drums').checked = s.drums;
    $('offset').value = String(s.audioOffsetMs);
    $('offsetLabel').textContent = `${s.audioOffsetMs} ms`;
    for (const input of document.querySelectorAll('[data-color]')) input.value = s.colors[input.dataset.color];
    for (const b of document.querySelectorAll('.palette')) b.classList.toggle('active', b.dataset.palette === s.palette);
  }

  syncControls();
  setSource('library');
  $('library').value = 'nuit';
  state.project = libraryProject('nuit');
  rebuild();
  resizeCanvas();
  requestAnimationFrame(frame);
  window.billeApp = { state, transport }; // pour le débogage dans la console
}

if (new URLSearchParams(location.search).has('render')) setupRenderMode();
else setupApp();
