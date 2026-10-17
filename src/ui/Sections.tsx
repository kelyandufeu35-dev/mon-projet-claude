import { forwardRef, useEffect, useRef } from 'react';
import { PARTS } from '../lib/content';
import { setUI, timelineListeners, useUI } from '../lib/store';
import { sampleChannel } from '../lib/timeline';
import { openPart } from './Parts';

/** Live readout during activation; values derive from the same timeline. */
function ActivationReadout() {
  const charge = useRef<HTMLSpanElement>(null);
  const rpm = useRef<HTMLSpanElement>(null);
  const status = useRef<HTMLSpanElement>(null);
  const bar = useRef<HTMLSpanElement>(null);
  const finalStatus = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    let lastStatus = '';
    const update = (t: number) => {
      const c = sampleChannel('charge', t);
      const spin = sampleChannel('ringSpin', t);
      const wave = sampleChannel('wave', t);
      if (charge.current) charge.current.textContent = String(Math.round(c * 100)).padStart(3, ' ');
      if (rpm.current) rpm.current.textContent = Math.round(spin * 7660).toLocaleString('fr-FR');
      if (bar.current) bar.current.style.transform = `scaleX(${c.toFixed(3)})`;
      const s = c < 0.01 ? 'Veille' : wave <= 0 ? 'Synchronisation' : wave < 0.999 ? 'Calibration' : 'Stable';
      if (s !== lastStatus && status.current) {
        lastStatus = s;
        status.current.textContent = s;
        status.current.dataset.state = s;
        // Screen readers only hear the meaningful final state.
        if (finalStatus.current) finalStatus.current.textContent = s === 'Stable' ? 'Cœur stable : activation terminée.' : '';
      }
    };
    timelineListeners.add(update);
    return () => {
      timelineListeners.delete(update);
    };
  }, []);

  return (
    <div className="readout">
      <div className="readout__row">
        <span className="readout__k">Charge du noyau</span>
        <span className="readout__v mono" aria-hidden="true">
          <span ref={charge}>{'  0'}</span> %
        </span>
      </div>
      <span className="readout__bar" aria-hidden="true">
        <span ref={bar} />
      </span>
      <div className="readout__row">
        <span className="readout__k">Anneaux</span>
        <span className="readout__v mono" aria-hidden="true">
          <span ref={rpm}>0</span> tr/min
        </span>
      </div>
      <div className="readout__row">
        <span className="readout__k">Statut</span>
        <span className="readout__v mono readout__status" ref={status} data-state="Veille" aria-hidden="true">
          Veille
        </span>
      </div>
      <p className="sr-only" role="status" ref={finalStatus} />
    </div>
  );
}

interface SectionsProps {
  onDemo: () => void;
  onRestart: () => void;
}

export const Sections = forwardRef<HTMLElement, SectionsProps>(function Sections({ onDemo, onRestart }, mainRef) {
  const webgl = useUI((s) => s.webgl);

  return (
    <main ref={mainRef} id="contenu">
      <section id="apparition" className="seq seq--hero" aria-labelledby="t-hero">
        <div className="seq__frame">
          <div className="hero">
            <p className="kicker reveal-1">
              <span className="dot" aria-hidden="true" /> Laboratoire NEXUS · Unité 7 · Séquence 01
            </p>
            <h1 id="t-hero" className="hero__title">
              <span className="sr-only">NEXUS — </span>
              <span className="hero__word" aria-hidden="true">
                {'NEXUS'.split('').map((c, i) => (
                  <span key={i} style={{ ['--d' as string]: i }}>
                    {c}
                  </span>
                ))}
              </span>
              <span className="hero__lede reveal-2">Le premier cœur énergétique à confinement gyroscopique.</span>
            </h1>
            <p className="hero__body reveal-3">
              Douze ans de recherche, quatre mille heures d’assemblage et une seule question&nbsp;: peut-on tenir une étoile dans une enceinte de
              trois mètres&nbsp;?
            </p>
            <dl className="hero__meta reveal-3">
              <div>
                <dt>Lot</dt>
                <dd>NX-07 / 26</dd>
              </div>
              <div>
                <dt>Site</dt>
                <dd>Grenoble · niveau −3</dd>
              </div>
              <div>
                <dt>État</dt>
                <dd>
                  <span className="dot dot--orange" aria-hidden="true" /> Confiné
                </dd>
              </div>
            </dl>
          </div>
          <p className="scroll-cue reveal-3" aria-hidden="true">
            <span className="scroll-cue__line" />
            Faites défiler pour lancer la séquence
          </p>
        </div>
      </section>

      <section id="exploration" className="seq" aria-labelledby="t-explo">
        <div className="seq__frame">
          <div className="panel">
            <p className="kicker">
              <span className="kicker__num">02</span> Anatomie
            </p>
            <h2 id="t-explo" className="title">
              Cinq sous-ensembles.
              <br />
              Un seul équilibre.
            </h2>
            <p className="lede lede--opt">
              Chaque pièce du cœur compense les contraintes des autres. {webgl ? 'Sélectionnez un repère sur l’objet ou parcourez la liste.' : 'Parcourez la liste des composants.'}
            </p>
            <ol className="part-list">
              {PARTS.map((p) => (
                <li key={p.id}>
                  <button
                    type="button"
                    className="part-list__item"
                    onClick={() => openPart(p.id)}
                    onPointerEnter={() => setUI({ hovered: p.id })}
                    onPointerLeave={() => setUI({ hovered: null })}
                    onFocus={() => setUI({ hovered: p.id })}
                    onBlur={() => setUI({ hovered: null })}
                  >
                    <span className="part-list__code mono">{p.index}</span>
                    <span className="part-list__name">{p.name}</span>
                    <span className="part-list__short">{p.short}</span>
                  </button>
                </li>
              ))}
            </ol>
            {webgl && (
              <div className="explore-cta">
                <button type="button" className="btn btn--ghost" onClick={() => setUI({ explore: true })} aria-describedby="explore-hint">
                  Prendre les commandes
                </button>
                <span className="explore-cta__hint" id="explore-hint">
                  Rotation libre · Échap pour revenir
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      <section id="decomposition" className="seq" aria-labelledby="t-decomp">
        <div className="seq__frame">
          <div className="panel">
            <p className="kicker">
              <span className="kicker__num">03</span> Vue éclatée
            </p>
            <h2 id="t-decomp" className="title title--xl">
              312 pièces.
              <br />
              Zéro soudure.
            </h2>
            <p className="lede">
              Tout s’emboîte par serrage magnétique. Le cœur se démonte en quarante minutes, sans outillage spécialisé&nbsp;: une première pour un
              réacteur de cette classe.
            </p>
            <dl className="stats">
              <div>
                <dt>Pièces usinées</dt>
                <dd>312</dd>
              </div>
              <div>
                <dt>Tolérance</dt>
                <dd>
                  0,8<small>µm</small>
                </dd>
              </div>
              <div>
                <dt>Démontage</dt>
                <dd>
                  40<small>min</small>
                </dd>
              </div>
            </dl>
          </div>
        </div>
      </section>

      <section id="activation" className="seq" aria-labelledby="t-activ">
        <div className="seq__frame">
          <div className="panel">
            <p className="kicker">
              <span className="kicker__num">04</span> Activation
            </p>
            <h2 id="t-activ" className="title">
              La coque se referme.
              <br />
              Le noyau s’allume.
            </h2>
            <p className="lede lede--opt">
              Les anneaux montent à leur vitesse de synchronisation, puis une onde de calibration traverse toute la surface. Si elle revient intacte,
              le cœur est stable.
            </p>
            <ActivationReadout />
          </div>
        </div>
      </section>

      <section id="final" className="seq seq--final" aria-labelledby="t-final">
        <div className="seq__frame">
          <div className="finale">
            <p className="kicker">
              <span className="kicker__num">05</span> Programme pilote
            </p>
            <h2 id="t-final" className="finale__title">
              Voir NEXUS
              <br />
              fonctionner.
            </h2>
            <div className="finale__row">
              <p className="lede">
                Douze créneaux de démonstration ouvrent au premier semestre 2027, sur site ou à distance, pour les équipes de recherche et
                d’ingénierie énergétique.
              </p>
              <div className="finale__actions">
                <button type="button" className="btn btn--primary btn--lg" onClick={onDemo}>
                  Réserver une démonstration
                  <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
                    <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.6" />
                  </svg>
                </button>
                <button type="button" className="btn btn--ghost" onClick={onRestart}>
                  Revoir la séquence
                </button>
              </div>
            </div>
          </div>
          <footer className="footer">
            <span>© 2026 NEXUS Laboratoire</span>
            <span>Laboratoire fictif — site de démonstration. Aucune donnée n’est transmise.</span>
          </footer>
        </div>
      </section>
    </main>
  );
});
