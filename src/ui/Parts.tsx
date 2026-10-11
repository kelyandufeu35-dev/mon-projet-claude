import { useEffect, useRef } from 'react';
import { PART_BY_ID, PARTS, type PartId } from '../lib/content';
import { hotspotEls, setUI, useUI } from '../lib/store';

let opener: HTMLElement | null = null;

export function openPart(id: PartId) {
  opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;
  setUI({ selected: id });
}

/** Screen-space markers anchored to the 3D components (positioned by the scene). */
export function Hotspots() {
  const active = useUI((s) => s.hotspots || s.explore);
  const webgl = useUI((s) => s.webgl);
  const ready = useUI((s) => s.ready);
  const selected = useUI((s) => s.selected);
  const hovered = useUI((s) => s.hovered);
  if (!webgl) return null;

  return (
    <div className="hotspots" data-active={active && ready ? '' : undefined} role="group" aria-label="Repères sur le cœur">
      {PARTS.map((p) => (
        <button
          key={p.id}
          type="button"
          className="hotspot"
          hidden={!active || !ready}
          data-on={selected === p.id || hovered === p.id ? '' : undefined}
          ref={(el) => {
            if (el) hotspotEls[p.id] = el;
            else delete hotspotEls[p.id];
          }}
          onClick={() => openPart(p.id)}
          onFocus={() => setUI({ hovered: p.id })}
          onBlur={() => setUI({ hovered: null })}
          onPointerEnter={() => setUI({ hovered: p.id })}
          onPointerLeave={() => setUI({ hovered: null })}
          aria-label={`${p.name} — ouvrir la fiche`}
        >
          <span className="hotspot__dot" aria-hidden="true" />
          <span className="hotspot__label" aria-hidden="true">
            <span className="hotspot__code">{p.index}</span>
            {p.name}
          </span>
        </button>
      ))}
    </div>
  );
}

export function PartPanel() {
  const selected = useUI((s) => s.selected);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const part = selected ? PART_BY_ID[selected] : null;

  useEffect(() => {
    if (!selected) return;
    titleRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const close = () => {
    setUI({ selected: null });
    if (opener && document.contains(opener)) opener.focus({ preventScroll: true });
    opener = null;
  };

  const step = (dir: number) => {
    if (!selected) return;
    const i = PARTS.findIndex((p) => p.id === selected);
    setUI({ selected: PARTS[(i + dir + PARTS.length) % PARTS.length].id });
  };

  if (!part) return null;
  const i = PARTS.indexOf(part);

  return (
    <aside className="part-panel" role="dialog" aria-modal="false" aria-labelledby="part-title">
      <div className="part-panel__head">
        <span className="part-panel__code">
          {part.index} · {String(i + 1).padStart(2, '0')}/{String(PARTS.length).padStart(2, '0')}
        </span>
        <button type="button" className="icon-btn" onClick={close} aria-label="Fermer la fiche">
          <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
            <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" />
          </svg>
        </button>
      </div>
      <h2 id="part-title" ref={titleRef} tabIndex={-1}>
        {part.name}
      </h2>
      <p className="part-panel__short">{part.short}</p>
      <p>{part.description}</p>
      <dl className="specs">
        {part.specs.map(([k, v]) => (
          <div key={k}>
            <dt>{k}</dt>
            <dd>{v}</dd>
          </div>
        ))}
      </dl>
      <div className="part-panel__nav">
        <button type="button" className="chip" onClick={() => step(-1)}>
          ← Précédent
        </button>
        <button type="button" className="chip" onClick={() => step(1)}>
          Suivant →
        </button>
      </div>
    </aside>
  );
}
