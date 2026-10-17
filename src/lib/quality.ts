import type { Tier } from './store';

export interface GPUInfo {
  ok: boolean;
  renderer: string;
  software: boolean;
}

export function detectWebGL(): GPUInfo {
  if (new URLSearchParams(location.search).has('nowebgl')) {
    return { ok: false, renderer: 'disabled', software: false };
  }
  try {
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2');
    if (!gl) return { ok: false, renderer: 'none', software: false };
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    const renderer = String(ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : gl.getParameter(gl.RENDERER));
    gl.getExtension('WEBGL_lose_context')?.loseContext();
    const software = /swiftshader|llvmpipe|software|basic render/i.test(renderer);
    return { ok: true, renderer, software };
  } catch {
    return { ok: false, renderer: 'error', software: false };
  }
}

export function isMobileLayout() {
  return window.matchMedia('(max-width: 760px)').matches;
}

export function detectTier(gpu: GPUInfo): Tier {
  const forced = new URLSearchParams(location.search).get('quality');
  if (forced === 'high' || forced === 'medium' || forced === 'low') return forced;
  if (gpu.software) return 'low';
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory ?? 8;
  if (coarse) return cores >= 8 && memory >= 6 ? 'medium' : 'low';
  if (cores <= 4 || memory <= 4) return 'medium';
  return 'high';
}

export interface TierSettings {
  maxDpr: number;
  minDpr: number;
  msaa: number;
  bloom: boolean;
  bloomScale: number;
  particles: number;
  sphereDetail: number;
  grain: boolean;
}

export const TIER_SETTINGS: Record<Tier, TierSettings> = {
  high: { maxDpr: 2, minDpr: 1, msaa: 4, bloom: true, bloomScale: 0.5, particles: 900, sphereDetail: 40, grain: true },
  medium: { maxDpr: 1.5, minDpr: 0.85, msaa: 2, bloom: true, bloomScale: 0.4, particles: 600, sphereDetail: 28, grain: true },
  low: { maxDpr: 1, minDpr: 0.6, msaa: 0, bloom: true, bloomScale: 0.3, particles: 280, sphereDetail: 18, grain: false },
};
