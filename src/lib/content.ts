export type PartId = 'core' | 'rings' | 'shell' | 'injectors' | 'crown';

export interface PartInfo {
  id: PartId;
  index: string;
  name: string;
  short: string;
  description: string;
  specs: [string, string][];
}

export const PARTS: PartInfo[] = [
  {
    id: 'core',
    index: 'N-7',
    name: 'Noyau N-7',
    short: 'Plasma confiné',
    description:
      'Une sphère de plasma de 1,1 m maintenue en suspension. Sa surface est stabilisée par un champ en rotation permanente : elle ne touche jamais aucune paroi.',
    specs: [
      ['Température', '14 000 K'],
      ['Densité énergétique', '2,4 GJ/L'],
      ['Durée de service', '30 ans'],
    ],
  },
  {
    id: 'rings',
    index: 'G-3',
    name: 'Anneaux gyroscopiques',
    short: 'Confinement actif',
    description:
      'Trois anneaux contrarotatifs gardent le champ de confinement aligné, quelle que soit l’orientation du cœur. Leur synchronisation se règle à la microseconde.',
    specs: [
      ['Vitesse nominale', '18 400 tr/min'],
      ['Alliage', 'Niobium-titane'],
      ['Jeu mécanique', '0,3 mm'],
    ],
  },
  {
    id: 'shell',
    index: 'C-12',
    name: 'Coque segmentée',
    short: 'Blindage modulaire',
    description:
      'Douze pétales en alliage de tungstène s’ouvrent pour la maintenance et absorbent l’essentiel du rayonnement. Chaque pétale se remplace sans arrêter le cœur.',
    specs: [
      ['Pétales', '12'],
      ['Épaisseur', '42 mm'],
      ['Absorption', '99,7 %'],
    ],
  },
  {
    id: 'injectors',
    index: 'I-4',
    name: 'Injecteurs radiaux',
    short: 'Alimentation',
    description:
      'Quatre injecteurs alimentent le noyau en deutérium et corrigent sa pression en temps réel. Leur bague orange signale l’état de charge.',
    specs: [
      ['Débit', '0,8 g/s'],
      ['Temps de réponse', '3 ms'],
      ['Pression', '220 bar'],
    ],
  },
  {
    id: 'crown',
    index: 'P-2',
    name: 'Couronnes polaires',
    short: 'Axe et dissipation',
    description:
      'Les deux couronnes portent l’axe principal et évacuent la chaleur excédentaire vers le circuit d’hélium. Vingt-quatre boulons magnétiques les verrouillent.',
    specs: [
      ['Dissipation', '4,2 MW'],
      ['Boulons', '24'],
      ['Refroidissement', 'Hélium'],
    ],
  },
];

export const PART_BY_ID = Object.fromEntries(PARTS.map((p) => [p.id, p])) as Record<PartId, PartInfo>;

export const SECTIONS = [
  { id: 'apparition', index: '01', label: 'Apparition' },
  { id: 'exploration', index: '02', label: 'Anatomie' },
  { id: 'decomposition', index: '03', label: 'Vue éclatée' },
  { id: 'activation', index: '04', label: 'Activation' },
  { id: 'final', index: '05', label: 'Programme' },
] as const;
