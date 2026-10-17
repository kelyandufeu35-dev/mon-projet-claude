import { useSyncExternalStore } from 'react';
import type { PartId } from './content';

export type Tier = 'high' | 'medium' | 'low';

/** Coarse UI state: changes rarely, drives React renders. */
export interface UIState {
  motion: boolean;
  explore: boolean;
  selected: PartId | null;
  hovered: PartId | null;
  hotspots: boolean;
  section: number;
  ready: boolean;
  webgl: boolean;
}

let state: UIState = {
  motion: true,
  explore: false,
  selected: null,
  hovered: null,
  hotspots: false,
  section: 0,
  ready: false,
  webgl: true,
};

const listeners = new Set<() => void>();

export function getUI() {
  return state;
}

export function setUI(patch: Partial<UIState>) {
  let changed = false;
  for (const k in patch) {
    const key = k as keyof UIState;
    if (state[key] !== patch[key]) {
      changed = true;
      break;
    }
  }
  if (!changed) return;
  state = { ...state, ...patch };
  listeners.forEach((l) => l());
  frame.invalidate();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useUI<T>(selector: (s: UIState) => T): T {
  return useSyncExternalStore(subscribe, () => selector(state), () => selector(state));
}

/**
 * Per-frame mutable state. Written by DOM listeners, read inside the render
 * loop. Never triggers React renders.
 */
export const frame = {
  /** Scroll timeline target, 0..5 (one unit per sequence). */
  t: 0,
  /** Smoothed timeline used by the scene. */
  ts: 0,
  /** Normalised pointer, -1..1. */
  px: 0,
  py: 0,
  /** Explore-mode orbit targets (radians / radius delta). */
  orbitAz: 0,
  orbitEl: 0,
  zoom: 0,
  /** Live values published by the scene for the HTML HUD. */
  charge: 0,
  tier: 'high' as Tier,
  fps: 0,
  dpr: 1,
  calls: 0,
  triangles: 0,
  /** Smoothed JS cost of the scene update and of submitting the render. */
  updateMs: 0,
  renderMs: 0,
  invalidate: () => {},
};

/** Called with the raw timeline position on every scroll update. */
export const timelineListeners = new Set<(t: number) => void>();

/** HTML hotspot elements, positioned by the scene every frame. */
export const hotspotEls: Partial<Record<PartId, HTMLElement>> = {};
