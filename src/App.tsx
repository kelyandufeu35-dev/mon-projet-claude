import { Component, lazy, Suspense, useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { bindScrollTimeline } from './lib/scroll';
import { frame, getUI, setUI, useUI } from './lib/store';
import { Header, ProgressRail } from './ui/Chrome';
import { DemoDialog } from './ui/DemoDialog';
import { ExploreOverlay, useExploreControls } from './ui/Explore';
import { Hotspots, PartPanel } from './ui/Parts';
import { Sections } from './ui/Sections';
import { StaticCore } from './ui/StaticCore';

const Experience = lazy(() => import('./scene/Experience'));

/** Falls back to the static illustration if the 3D scene fails to start. */
class SceneBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: unknown) {
    console.warn('[nexus] 3D désactivée :', error);
    setUI({ webgl: false, ready: true });
  }
  render() {
    return this.state.failed ? <StaticCore /> : this.props.children;
  }
}

function hideBoot() {
  const boot = document.getElementById('boot');
  if (!boot) return;
  boot.classList.add('is-done');
  window.setTimeout(() => boot.remove(), 900);
}

export default function App() {
  const webgl = useUI((s) => s.webgl);
  const motion = useUI((s) => s.motion);
  const ready = useUI((s) => s.ready);
  const [demoOpen, setDemoOpen] = useState(false);
  const mainRef = useRef<HTMLElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<ReturnType<typeof bindScrollTimeline> | null>(null);

  useExploreControls();

  useEffect(() => {
    const sections = Array.from(mainRef.current!.querySelectorAll<HTMLElement>('section.seq'));
    navRef.current = bindScrollTimeline(sections);
    return () => navRef.current?.dispose();
  }, []);

  // Motion preference: reflected on <html> for CSS, remembered per viewer.
  useEffect(() => {
    document.documentElement.classList.toggle('no-motion', !motion);
    try {
      localStorage.setItem('nexus-motion', motion ? '1' : '0');
    } catch {
      /* storage unavailable: preference lasts for this visit only */
    }
  }, [motion]);

  useEffect(() => {
    document.documentElement.classList.toggle('is-ready', ready);
    if (ready) hideBoot();
  }, [ready]);

  // Without WebGL there is nothing to wait for.
  useEffect(() => {
    if (!webgl) setUI({ ready: true });
  }, [webgl]);

  // Safety net: never leave the loader up.
  useEffect(() => {
    const id = window.setTimeout(() => setUI({ ready: true }), 9000);
    return () => window.clearTimeout(id);
  }, []);

  // Pointer for the object's parallax.
  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === 'touch') return;
      frame.px = (e.clientX / window.innerWidth) * 2 - 1;
      frame.py = (e.clientY / window.innerHeight) * 2 - 1;
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  // Lost GPU context → static presentation instead of a black page.
  useEffect(() => {
    const canvas = stageRef.current?.querySelector('canvas');
    if (!canvas) return;
    const onLost = (e: Event) => {
      e.preventDefault();
      setUI({ webgl: false, explore: false, ready: true });
    };
    canvas.addEventListener('webglcontextlost', onLost);
    return () => canvas.removeEventListener('webglcontextlost', onLost);
  }, [ready, webgl]);

  const navigate = useCallback((i: number) => {
    if (getUI().explore) setUI({ explore: false });
    navRef.current?.scrollToSection(i, getUI().motion);
  }, []);

  const onReady = useCallback(() => setUI({ ready: true }), []);

  return (
    <>
      <a className="skip-link" href="#contenu">
        Aller au contenu
      </a>
      <div ref={stageRef} className="stage" data-webgl={webgl ? '' : undefined}>
        {webgl ? (
          <SceneBoundary>
            <Suspense fallback={null}>
              <Experience tier={frame.tier} onReady={onReady} />
            </Suspense>
          </SceneBoundary>
        ) : (
          <StaticCore />
        )}
      </div>
      <div className="veil" aria-hidden="true" />
      <Header onNavigate={navigate} onDemo={() => setDemoOpen(true)} />
      <ProgressRail onNavigate={navigate} />
      <Hotspots />
      <Sections ref={mainRef} onDemo={() => setDemoOpen(true)} onRestart={() => navigate(0)} />
      <PartPanel />
      <ExploreOverlay />
      <DemoDialog open={demoOpen} onClose={() => setDemoOpen(false)} />
    </>
  );
}
