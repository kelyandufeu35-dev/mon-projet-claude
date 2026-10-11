import { SECTIONS } from '../lib/content';
import { setUI, useUI } from '../lib/store';

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className="brand__mark">
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <ellipse cx="16" cy="16" rx="13" ry="4.5" fill="none" stroke="currentColor" strokeOpacity=".5" strokeWidth="1" />
      <circle cx="16" cy="16" r="4" fill="var(--cyan)" />
      <rect x="15.2" y="0" width="1.6" height="5" fill="var(--orange)" />
    </svg>
  );
}

interface HeaderProps {
  onNavigate: (i: number) => void;
  onDemo: () => void;
}

export function Header({ onNavigate, onDemo }: HeaderProps) {
  const motion = useUI((s) => s.motion);
  const explore = useUI((s) => s.explore);
  const webgl = useUI((s) => s.webgl);
  const section = useUI((s) => s.section);

  return (
    <header className="topbar">
      <a
        className="brand"
        href="#apparition"
        onClick={(e) => {
          e.preventDefault();
          onNavigate(0);
        }}
      >
        <BrandMark />
        <span className="brand__name">NEXUS</span>
        <span className="brand__tag">Laboratoire</span>
      </a>

      <nav className="topnav" aria-label="Séquences">
        <ol>
          {SECTIONS.map((s, i) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                aria-current={section === i ? 'step' : undefined}
                onClick={(e) => {
                  e.preventDefault();
                  onNavigate(i);
                }}
              >
                <span className="topnav__index">{s.index}</span>
                <span className="topnav__label">{s.label}</span>
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="topbar__actions">
        {webgl && (
          <button
            type="button"
            className="chip"
            aria-pressed={explore}
            onClick={() => setUI({ explore: !explore })}
            title="Tourner librement autour du cœur"
          >
            <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
              <ellipse cx="10" cy="10" rx="8" ry="3.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <path d="M15.5 4.5 18 7l-3.2.8" fill="none" stroke="currentColor" strokeWidth="1.4" />
              <circle cx="10" cy="10" r="2" fill="currentColor" />
            </svg>
            <span className="chip__label">{explore ? 'Quitter l’exploration' : 'Explorer'}</span>
          </button>
        )}
        <button
          type="button"
          className="chip"
          aria-pressed={motion}
          onClick={() => setUI({ motion: !motion })}
          title={motion ? 'Désactiver les animations' : 'Activer les animations'}
        >
          <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden="true">
            {motion ? (
              <>
                <rect x="5" y="4" width="3" height="12" fill="currentColor" />
                <rect x="12" y="4" width="3" height="12" fill="currentColor" />
              </>
            ) : (
              <path d="M6 4l10 6-10 6z" fill="currentColor" />
            )}
          </svg>
          <span className="chip__label">Animations</span>
        </button>
        <button type="button" className="btn btn--primary btn--sm" onClick={onDemo}>
          <span className="hide-sm">Démonstration</span>
          <span className="show-sm">Démo</span>
        </button>
      </div>
    </header>
  );
}

export function ProgressRail({ onNavigate }: { onNavigate: (i: number) => void }) {
  const section = useUI((s) => s.section);
  const current = SECTIONS[section];
  return (
    <div className="rail">
      <div className="rail__readout" aria-hidden="true">
        <span className="rail__num">{current.index}</span>
        <span className="rail__total">/05</span>
      </div>
      <div className="rail__track" aria-hidden="true">
        <div className="rail__fill" />
      </div>
      <ol className="rail__steps">
        {SECTIONS.map((s, i) => (
          <li key={s.id} style={{ ['--i' as string]: i }}>
            <button
              type="button"
              className="rail__step"
              aria-current={section === i ? 'step' : undefined}
              onClick={() => onNavigate(i)}
            >
              <span className="sr-only">
                Séquence {s.index} : {s.label}
              </span>
              <span className="rail__tip" aria-hidden="true">
                {s.label}
              </span>
            </button>
          </li>
        ))}
      </ol>
    </div>
  );
}
