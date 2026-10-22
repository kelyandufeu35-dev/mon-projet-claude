import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/archivo/wdth.css';
import '@fontsource-variable/jetbrains-mono';
import './styles.css';
import App from './App';
import { detectTier, detectWebGL } from './lib/quality';
import { frame, setUI } from './lib/store';

const gpu = detectWebGL();
frame.tier = detectTier(gpu);

const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
let stored: string | null = null;
try {
  stored = localStorage.getItem('nexus-motion');
} catch {
  /* private mode */
}
setUI({
  webgl: gpu.ok,
  motion: stored ? stored === '1' : !reduce.matches,
});
reduce.addEventListener('change', (e) => setUI({ motion: !e.matches }));

document.documentElement.dataset.tier = frame.tier;
if (import.meta.env.DEV || new URLSearchParams(location.search).has('debug')) {
  Object.assign(window, { __nexus: { frame, gpu } });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
