import { clamp01, smoothstep } from './timeline';
import { frame, getUI, setUI, timelineListeners } from './store';

/**
 * Maps the native document scroll onto the 0..5 timeline. Each <section>
 * owns one timeline unit; its sticky frame stays pinned while its unit plays.
 * Text opacity is written straight to a CSS variable (no React render).
 */
export function bindScrollTimeline(sections: HTMLElement[]) {
  let tops: number[] = [];
  let heights: number[] = [];
  let maxScroll = 1;
  let vh = window.innerHeight;
  let raf = 0;

  const measure = () => {
    vh = window.innerHeight;
    tops = sections.map((s) => s.getBoundingClientRect().top + window.scrollY);
    heights = sections.map((s) => s.offsetHeight);
    maxScroll = Math.max(1, document.documentElement.scrollHeight - vh);
    update();
  };

  const update = () => {
    raf = 0;
    const y = window.scrollY;
    const n = sections.length;
    let t = 0;
    for (let i = 0; i < n; i++) {
      const lo = tops[i];
      const hi = i < n - 1 ? tops[i + 1] : maxScroll;
      if (y < hi || i === n - 1) {
        t = i + clamp01((y - lo) / Math.max(1, hi - lo));
        break;
      }
    }
    frame.t = t;
    document.documentElement.style.setProperty('--progress', (t / n).toFixed(4));
    timelineListeners.forEach((l) => l(t));

    for (let i = 0; i < n; i++) {
      const span = Math.max(1, heights[i] - vh);
      const local = (y - tops[i]) / span;
      const fadeIn = i === 0 ? 1 : smoothstep(-0.5, 0.04, local);
      const fadeOut = i === n - 1 ? 1 : 1 - smoothstep(0.78, 1.0, local);
      const v = fadeIn * fadeOut;
      sections[i].style.setProperty('--in', v.toFixed(3));
      sections[i].style.setProperty('--local', clamp01(local).toFixed(3));
    }

    setUI({
      section: Math.min(n - 1, Math.floor(t + 0.3)),
      hotspots: t > 0.85 && t < 2.9,
    });
    frame.invalidate();
  };

  const onScroll = () => {
    if (!raf) raf = requestAnimationFrame(update);
  };

  // Keyboard users tabbing into a section that is faded out: bring it to its
  // readable position so focus never lands on invisible content.
  const onFocusIn = (e: FocusEvent) => {
    if (getUI().explore) return;
    const target = e.target as HTMLElement;
    const i = sections.findIndex((s) => s.contains(target));
    if (i < 0) return;
    const current = parseFloat(sections[i].style.getPropertyValue('--in') || '0');
    if (current > 0.6) return;
    const span = Math.max(0, heights[i] - vh);
    window.scrollTo({ top: tops[i] + span * (i === 0 ? 0 : 0.3), behavior: 'auto' });
  };

  const ro = new ResizeObserver(measure);
  ro.observe(document.body);
  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', measure);
  document.addEventListener('focusin', onFocusIn);
  measure();

  return {
    scrollToSection(i: number, smooth: boolean) {
      const span = Math.max(0, heights[i] - vh);
      const top = i === 0 ? 0 : tops[i] + span * 0.3;
      window.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' });
    },
    dispose() {
      ro.disconnect();
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', measure);
      document.removeEventListener('focusin', onFocusIn);
      if (raf) cancelAnimationFrame(raf);
    },
  };
}
