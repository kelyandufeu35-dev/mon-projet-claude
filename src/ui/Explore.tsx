import { useEffect, useRef } from 'react';
import { frame, getUI, setUI, useUI } from '../lib/store';

const EL_MIN = -0.9;
const EL_MAX = 0.9;
const ZOOM_MIN = -2.5;
const ZOOM_MAX = 7;

function clampOrbit() {
  frame.orbitEl = Math.min(EL_MAX, Math.max(EL_MIN, frame.orbitEl));
  frame.zoom = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, frame.zoom));
  frame.invalidate();
}

/**
 * Free-orbit mode. While active, page scroll is frozen (so the wheel and
 * touch drags drive the camera instead) and restored on exit.
 */
export function useExploreControls() {
  const explore = useUI((s) => s.explore);

  useEffect(() => {
    if (!explore) return;
    const html = document.documentElement;
    html.classList.add('is-exploring');
    frame.orbitAz = 0;
    frame.orbitEl = 0;
    frame.zoom = 0;

    const pointers = new Map<number, { x: number; y: number }>();
    let pinch = 0;
    let travel = 0;
    // Events are read at window level so a drag or wheel that starts over a
    // hotspot still orbits; the HUD and panels keep their own behaviour.
    const isUI = (e: Event) => !!(e.target as Element | null)?.closest?.('.topbar, .explore-hud, .part-panel, .rail, dialog');

    const onDown = (e: PointerEvent) => {
      if (isUI(e) || (e.pointerType === 'mouse' && e.button !== 0)) return;
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      travel = 0;
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = Math.hypot(a.x - b.x, a.y - b.y);
      }
    };
    const onMove = (e: PointerEvent) => {
      const prev = pointers.get(e.pointerId);
      if (!prev) return;
      const dx = e.clientX - prev.x;
      const dy = e.clientY - prev.y;
      prev.x = e.clientX;
      prev.y = e.clientY;
      travel += Math.abs(dx) + Math.abs(dy);
      if (pointers.size === 1) {
        frame.orbitAz -= dx * 0.0075;
        frame.orbitEl += dy * 0.0055;
      } else if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        frame.zoom -= (d - pinch) * 0.02;
        pinch = d;
      }
      clampOrbit();
    };
    const onUp = (e: PointerEvent) => {
      pointers.delete(e.pointerId);
    };
    // A drag that ends on a hotspot must not open its sheet.
    const onClick = (e: MouseEvent) => {
      if (travel > 6 && !isUI(e)) {
        e.stopPropagation();
        e.preventDefault();
      }
      travel = 0;
    };
    const onWheel = (e: WheelEvent) => {
      if (isUI(e)) return;
      e.preventDefault();
      frame.zoom += Math.sign(e.deltaY) * Math.min(1, Math.abs(e.deltaY) / 120) * 0.6;
      clampOrbit();
    };
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.closest('input, textarea, select, dialog')) return;
      switch (e.key) {
        case 'ArrowLeft':
          frame.orbitAz += 0.15;
          break;
        case 'ArrowRight':
          frame.orbitAz -= 0.15;
          break;
        case 'ArrowUp':
          frame.orbitEl += 0.12;
          break;
        case 'ArrowDown':
          frame.orbitEl -= 0.12;
          break;
        case '+':
        case '=':
          frame.zoom -= 0.6;
          break;
        case '-':
          frame.zoom += 0.6;
          break;
        case 'Escape':
          // The part sheet handles its own Escape first.
          if (!getUI().selected) setUI({ explore: false });
          return;
        default:
          return;
      }
      e.preventDefault();
      clampOrbit();
    };

    window.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    window.addEventListener('click', onClick, true);
    window.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    return () => {
      html.classList.remove('is-exploring');
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      window.removeEventListener('click', onClick, true);
      window.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      frame.orbitAz = 0;
      frame.orbitEl = 0;
      frame.zoom = 0;
      frame.invalidate();
    };
  }, [explore]);
}

export function ExploreOverlay() {
  const explore = useUI((s) => s.explore);
  const exitRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<Element | null>(null);

  useEffect(() => {
    if (explore) {
      returnTo.current = document.activeElement;
      exitRef.current?.focus({ preventScroll: true });
    } else if (returnTo.current instanceof HTMLElement) {
      returnTo.current.focus({ preventScroll: true });
      returnTo.current = null;
    }
  }, [explore]);

  if (!explore) return null;
  return (
    <div className="explore-hud" role="region" aria-label="Mode exploration">
      <p className="explore-hud__title">Mode exploration</p>
      <ul className="explore-hud__keys">
        <li>
          <kbd>Glisser</kbd> ou <kbd>←</kbd>
          <kbd>→</kbd>
          <kbd>↑</kbd>
          <kbd>↓</kbd> tourner
        </li>
        <li>
          <kbd>Molette</kbd>, pincement ou <kbd>+</kbd>
          <kbd>−</kbd> distance
        </li>
        <li>
          <kbd>Échap</kbd> quitter
        </li>
      </ul>
      <button ref={exitRef} type="button" className="btn btn--ghost btn--sm" onClick={() => setUI({ explore: false })}>
        Reprendre la séquence
      </button>
    </div>
  );
}
