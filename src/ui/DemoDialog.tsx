import { useEffect, useId, useRef, useState } from 'react';

interface Fields {
  name: string;
  email: string;
  org: string;
  format: string;
  period: string;
  message: string;
  consent: boolean;
}

type Errors = Partial<Record<keyof Fields, string>>;

const EMPTY: Fields = { name: '', email: '', org: '', format: '', period: '', message: '', consent: false };
const MESSAGE_MAX = 400;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Indiquez votre nom complet.';
  if (!f.email.trim()) e.email = 'Indiquez une adresse e-mail.';
  else if (!EMAIL.test(f.email.trim())) e.email = 'Cette adresse e-mail ne semble pas valide (ex. : nom@labo.fr).';
  if (f.org.trim().length < 2) e.org = 'Indiquez votre organisation.';
  if (!f.format) e.format = 'Choisissez un format de démonstration.';
  if (!f.period) e.period = 'Choisissez une période.';
  if (f.message.length > MESSAGE_MAX) e.message = `${MESSAGE_MAX} caractères maximum.`;
  if (!f.consent) e.consent = 'Votre accord est nécessaire pour traiter la demande.';
  return e;
}

const ORDER: (keyof Fields)[] = ['name', 'email', 'org', 'format', 'period', 'message', 'consent'];

export function DemoDialog({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [fields, setFields] = useState<Fields>(EMPTY);
  const [errors, setErrors] = useState<Errors>({});
  const [submitted, setSubmitted] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      d.showModal();
      document.documentElement.classList.add('has-dialog');
    } else if (!open && d.open) {
      d.close();
    }
  }, [open]);

  const reset = () => {
    setFields(EMPTY);
    setErrors({});
    setSubmitted(false);
    setDone(null);
  };

  const set = <K extends keyof Fields>(k: K, v: Fields[K]) => {
    const next = { ...fields, [k]: v };
    setFields(next);
    if (submitted) setErrors(validate(next));
  };

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitted(true);
    const errs = validate(fields);
    setErrors(errs);
    const first = ORDER.find((k) => errs[k]);
    if (first) {
      const el = formRef.current?.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      return;
    }
    const ref = `NX-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    setDone(ref);
  };

  const describedBy = (k: keyof Fields, extra?: string) =>
    [errors[k] ? id(`${k}-err`) : '', extra ?? ''].filter(Boolean).join(' ') || undefined;

  const err = (k: keyof Fields) =>
    errors[k] ? (
      <p className="field__error" id={id(`${k}-err`)}>
        {errors[k]}
      </p>
    ) : null;

  const errorCount = Object.keys(errors).length;

  return (
    <dialog
      ref={ref}
      className="demo"
      aria-labelledby={id('title')}
      onClose={() => {
        document.documentElement.classList.remove('has-dialog');
        onClose();
        if (done) reset();
      }}
      onClick={(e) => {
        // Backdrop click closes (the dialog element itself is the backdrop hit).
        if (e.target === ref.current) ref.current?.close();
      }}
    >
      <div className="demo__inner">
        <div className="demo__head">
          <p className="kicker">Programme pilote · 2027</p>
          <button type="button" className="icon-btn" onClick={() => ref.current?.close()} aria-label="Fermer">
            <svg viewBox="0 0 20 20" width="18" height="18" aria-hidden="true">
              <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>

        {done ? (
          <div className="demo__done" role="status">
            <h2 id={id('title')}>Demande enregistrée.</h2>
            <p>
              Référence <strong className="mono">{done}</strong>. Merci {fields.name.trim().split(' ')[0]} : votre demande de démonstration{' '}
              {fields.format === 'site' ? 'sur site' : 'à distance'} est prête.
            </p>
            <p className="demo__note">
              Ce site est une démonstration : la demande a été validée dans votre navigateur et n’a été envoyée nulle part.
            </p>
            <button type="button" className="btn btn--primary" onClick={() => ref.current?.close()} autoFocus>
              Fermer
            </button>
          </div>
        ) : (
          <form ref={formRef} noValidate onSubmit={onSubmit}>
            <h2 id={id('title')}>Réserver une démonstration</h2>
            <p className="demo__intro">Quarante-cinq minutes face au cœur actif, avec l’équipe d’ingénierie. Réponse sous cinq jours ouvrés.</p>

            {submitted && errorCount > 0 && (
              <p className="demo__summary" role="alert">
                {errorCount === 1 ? 'Un champ demande votre attention.' : `${errorCount} champs demandent votre attention.`}
              </p>
            )}

            <div className="grid-2">
              <div className="field">
                <label htmlFor={id('name')}>Nom complet</label>
                <input
                  id={id('name')}
                  name="name"
                  autoComplete="name"
                  value={fields.name}
                  onChange={(e) => set('name', e.target.value)}
                  aria-invalid={!!errors.name}
                  aria-describedby={describedBy('name')}
                  required
                />
                {err('name')}
              </div>
              <div className="field">
                <label htmlFor={id('email')}>E-mail professionnel</label>
                <input
                  id={id('email')}
                  name="email"
                  type="email"
                  autoComplete="email"
                  inputMode="email"
                  value={fields.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={!!errors.email}
                  aria-describedby={describedBy('email')}
                  required
                />
                {err('email')}
              </div>
            </div>

            <div className="field">
              <label htmlFor={id('org')}>Organisation</label>
              <input
                id={id('org')}
                name="org"
                autoComplete="organization"
                value={fields.org}
                onChange={(e) => set('org', e.target.value)}
                aria-invalid={!!errors.org}
                aria-describedby={describedBy('org')}
                required
              />
              {err('org')}
            </div>

            <fieldset className="field" aria-describedby={describedBy('format')}>
              <legend>Format</legend>
              <div className="segmented">
                {[
                  ['site', 'Sur site', 'Laboratoire, niveau −3'],
                  ['remote', 'À distance', 'Flux commenté en direct'],
                ].map(([value, label, hint]) => (
                  <label key={value} className="segmented__opt">
                    <input
                      type="radio"
                      name="format"
                      value={value}
                      checked={fields.format === value}
                      onChange={() => set('format', value)}
                      aria-invalid={!!errors.format}
                    />
                    <span>
                      <strong>{label}</strong>
                      <small>{hint}</small>
                    </span>
                  </label>
                ))}
              </div>
              {err('format')}
            </fieldset>

            <div className="field">
              <label htmlFor={id('period')}>Période souhaitée</label>
              <select
                id={id('period')}
                name="period"
                value={fields.period}
                onChange={(e) => set('period', e.target.value)}
                aria-invalid={!!errors.period}
                aria-describedby={describedBy('period')}
                required
              >
                <option value="">Sélectionner…</option>
                <option value="2027-01">Janvier – février 2027</option>
                <option value="2027-03">Mars – avril 2027</option>
                <option value="2027-05">Mai – juin 2027</option>
              </select>
              {err('period')}
            </div>

            <div className="field">
              <label htmlFor={id('message')}>
                Contexte <span className="field__opt">(facultatif)</span>
              </label>
              <textarea
                id={id('message')}
                name="message"
                rows={3}
                value={fields.message}
                onChange={(e) => set('message', e.target.value)}
                aria-invalid={!!errors.message}
                aria-describedby={describedBy('message', id('message-count'))}
              />
              <p className="field__count" id={id('message-count')} data-over={fields.message.length > MESSAGE_MAX ? '' : undefined}>
                {fields.message.length} / {MESSAGE_MAX}
              </p>
              {err('message')}
            </div>

            <div className="field field--check">
              <label>
                <input
                  type="checkbox"
                  name="consent"
                  checked={fields.consent}
                  onChange={(e) => set('consent', e.target.checked)}
                  aria-invalid={!!errors.consent}
                  aria-describedby={describedBy('consent')}
                />
                <span>J’accepte d’être recontacté·e au sujet de cette démonstration.</span>
              </label>
              {err('consent')}
            </div>

            <div className="demo__actions">
              <button type="submit" className="btn btn--primary">
                Envoyer la demande
              </button>
              <p className="demo__note">Démonstration : aucune donnée ne quitte votre navigateur.</p>
            </div>
          </form>
        )}
      </div>
    </dialog>
  );
}
