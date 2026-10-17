import { useSyncExternalStore } from 'react';
import { config } from '../config';
import type { CartLine } from './pricing';

const KEY = 'boutique-cart-v1';
const MAX_QTY = 20;

interface CartState {
  lines: CartLine[];
  open: boolean;
  /** Bumped on each add, so the header badge can pulse. */
  pulse: number;
}

function load(): CartLine[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as CartLine[];
    const ids = new Set(config.product.variants.map((v) => v.id));
    return parsed.filter((l) => ids.has(l.variantId) && Number.isInteger(l.qty) && l.qty > 0).map((l) => ({ ...l, qty: Math.min(MAX_QTY, l.qty) }));
  } catch {
    return [];
  }
}

let state: CartState = { lines: load(), open: false, pulse: 0 };
const listeners = new Set<() => void>();

function set(next: Partial<CartState>) {
  state = { ...state, ...next };
  if (next.lines) {
    try {
      localStorage.setItem(KEY, JSON.stringify(state.lines));
    } catch {
      /* storage unavailable: the cart lasts for this visit only */
    }
  }
  listeners.forEach((l) => l());
}

export const cart = {
  add(variantId: string, qty: number) {
    const lines = [...state.lines];
    const i = lines.findIndex((l) => l.variantId === variantId);
    if (i >= 0) lines[i] = { ...lines[i], qty: Math.min(MAX_QTY, lines[i].qty + qty) };
    else lines.push({ variantId, qty: Math.min(MAX_QTY, qty) });
    set({ lines, open: true, pulse: state.pulse + 1 });
  },
  setQty(variantId: string, qty: number) {
    const lines = state.lines
      .map((l) => (l.variantId === variantId ? { ...l, qty: Math.max(0, Math.min(MAX_QTY, qty)) } : l))
      .filter((l) => l.qty > 0);
    set({ lines });
  },
  remove(variantId: string) {
    set({ lines: state.lines.filter((l) => l.variantId !== variantId) });
  },
  clear() {
    set({ lines: [] });
  },
  open() {
    set({ open: true });
  },
  close() {
    set({ open: false });
  },
};

export const MAX_LINE_QTY = MAX_QTY;

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useCart<T>(selector: (s: CartState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

/** Keep tabs in sync. */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key === KEY) set({ lines: load() });
  });
}
