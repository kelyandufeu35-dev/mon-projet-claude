import { useId, useState } from 'react';
import { config } from '../config';
import { useSeo } from '../lib/util';

interface Fields {
  name: string;
  email: string;
  order: string;
  message: string;
}
type Errors = Partial<Record<keyof Fields, string>>;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

function validate(f: Fields): Errors {
  const e: Errors = {};
  if (f.name.trim().length < 2) e.name = 'Indique ton prénom ou ton nom.';
  if (!EMAIL.test(f.email.trim())) e.email = 'Indique une adresse e-mail valide, par exemple prenom@mail.fr.';
  if (f.message.trim().length < 10) e.message = 'Ton message doit faire au moins 10 caractères.';
  return e;
}

export default function Contact() {
  useSeo('Contact', `Écris à ${config.brand.name}, réponse ${config.contact.responseTime}.`);
  const [f, setF] = useState<Fields>({ name: '', email: '', order: '', message: '' });
  const [errors, setErrors] = useState<Errors>({});
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'mail' | 'failed'>('idle');
  const uid = useId();
  const id = (k: string) => `${uid}-${k}`;
  const endpoint = config.contact.formEndpoint;

  const set = (k: keyof Fields, v: string) => {
    const next = { ...f, [k]: v };
    setF(next);
    if (Object.keys(errors).length) setErrors(validate(next));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate(f);
    setErrors(errs);
    const first = (Object.keys(errs) as (keyof Fields)[])[0];
    if (first) {
      document.getElementById(id(first))?.focus();
      return;
    }
    if (!endpoint) {
      const body = `${f.message}\n\n— ${f.name}${f.order ? `\nCommande : ${f.order}` : ''}\n${f.email}`;
      window.location.href = `mailto:${config.contact.email}?subject=${encodeURIComponent(`Question ${f.order ? `(commande ${f.order})` : ''}`.trim())}&body=${encodeURIComponent(body)}`;
      setStatus('mail');
      return;
    }
    setStatus('sending');
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(f),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus('sent');
    } catch {
      setStatus('failed');
    }
  };

  const err = (k: keyof Fields) =>
    errors[k] ? (
      <p className="field__error" id={id(`${k}-err`)}>
        {errors[k]}
      </p>
    ) : null;
  const aria = (k: keyof Fields) => ({ 'aria-invalid': !!errors[k], 'aria-describedby': errors[k] ? id(`${k}-err`) : undefined });

  return (
    <article className="page wrap">
      <header className="page__head">
        <p className="eyebrow">{config.brand.name}</p>
        <h1 className="h1">Contact</h1>
        <p className="lead">
          Une question sur le jouet ou ta commande ? Réponse {config.contact.responseTime}. Tu peux aussi écrire directement à{' '}
          <a href={`mailto:${config.contact.email}`}>{config.contact.email}</a>.
        </p>
      </header>

      {status === 'sent' ? (
        <p className="notice notice--ok" role="status">
          Message envoyé. On te répond {config.contact.responseTime} à {f.email}.
        </p>
      ) : (
        <form className="form" noValidate onSubmit={submit}>
          <div className="form__row">
            <div className="field">
              <label htmlFor={id('name')}>Nom</label>
              <input id={id('name')} autoComplete="name" value={f.name} onChange={(e) => set('name', e.target.value)} {...aria('name')} />
              {err('name')}
            </div>
            <div className="field">
              <label htmlFor={id('email')}>E-mail</label>
              <input
                id={id('email')}
                type="email"
                autoComplete="email"
                value={f.email}
                onChange={(e) => set('email', e.target.value)}
                {...aria('email')}
              />
              {err('email')}
            </div>
          </div>
          <div className="field">
            <label htmlFor={id('order')}>
              Numéro de commande <span className="field__opt">(si tu en as un)</span>
            </label>
            <input id={id('order')} value={f.order} onChange={(e) => set('order', e.target.value)} />
          </div>
          <div className="field">
            <label htmlFor={id('message')}>Message</label>
            <textarea id={id('message')} rows={6} value={f.message} onChange={(e) => set('message', e.target.value)} {...aria('message')} />
            {err('message')}
          </div>
          {status === 'failed' && (
            <p className="notice" role="alert">
              L’envoi n’a pas fonctionné. Réessaie dans un instant ou écris à {config.contact.email}.
            </p>
          )}
          {status === 'mail' && (
            <p className="notice notice--ok" role="status">
              Ta messagerie s’est ouverte avec le message pré-rempli. Si rien ne s’est passé, écris à {config.contact.email}.
            </p>
          )}
          <button type="submit" className="btn btn--ink btn--lg" disabled={status === 'sending'}>
            {status === 'sending' ? 'Envoi…' : 'Envoyer le message'}
          </button>
        </form>
      )}
    </article>
  );
}
