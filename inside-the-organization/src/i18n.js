// Langue de sortie, fixée à la compilation (esbuild --define __LANG__) : 'fr' (source) ou 'en'.
// Les textes du code restent en français (clé) ; en anglais, tr() les remplace via src/locales/en.js.
import { EN } from './locales/en.js';
export const LANG = typeof __LANG__ !== 'undefined' ? __LANG__ : 'fr';
const missing = new Set();
export function tr(s) {
  if (LANG === 'fr' || s == null || s === '') return s;
  const v = EN[s];
  if (v === undefined) { if (!missing.has(s)) { missing.add(s); (window.__missingTr = window.__missingTr || []).push(s); } return s; }
  return v;
}
