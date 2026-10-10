// Voix off, chapitres et durées mesurées de la langue de sortie.
import FR from '../data/narration.json';
import EN from '../data/narration.en.json';
import VOD_FR from '../data/vo_durations.json';
import VOD_EN from '../data/vo_durations.en.json';
import { LANG } from './i18n.js';
export const NARR = LANG === 'en' ? EN : FR;
export const VOD = LANG === 'en' ? VOD_EN : VOD_FR;
