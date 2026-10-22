import { config } from '../config';

/**
 * Analytics are opt-in: nothing loads until the visitor accepts, as required
 * by the CNIL for advertising pixels.
 */
const KEY = 'boutique-consent-v1';
export type Consent = 'accepted' | 'refused' | null;

export const analyticsConfigured = () => !!(config.analytics.metaPixelId || config.analytics.googleAnalyticsId);

export function readConsent(): Consent {
  try {
    const v = localStorage.getItem(KEY);
    return v === 'accepted' || v === 'refused' ? v : null;
  } catch {
    return null;
  }
}

export function saveConsent(v: Exclude<Consent, null>) {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* ignore */
  }
  if (v === 'accepted') loadAnalytics();
}

let loaded = false;
type Fn = (...args: unknown[]) => void;
type W = Window & {
  fbq?: Fn & { queue?: unknown[]; callMethod?: Fn; loaded?: boolean; version?: string; push?: Fn };
  _fbq?: unknown;
  dataLayer?: unknown[];
  gtag?: Fn;
};

function script(src: string) {
  const s = document.createElement('script');
  s.async = true;
  s.src = src;
  document.head.appendChild(s);
}

export function loadAnalytics() {
  if (loaded || readConsent() !== 'accepted') return;
  loaded = true;
  const w = window as W;
  const { metaPixelId, googleAnalyticsId } = config.analytics;

  if (metaPixelId) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) fbq.callMethod(...args);
      else fbq.queue!.push(args);
    } as Fn & { queue?: unknown[]; callMethod?: Fn; loaded?: boolean; version?: string; push?: Fn };
    fbq.queue = [];
    fbq.loaded = true;
    fbq.version = '2.0';
    fbq.push = fbq;
    w.fbq = fbq;
    w._fbq = fbq;
    script('https://connect.facebook.net/en_US/fbevents.js');
    fbq('init', metaPixelId);
    fbq('track', 'PageView');
  }
  if (googleAnalyticsId) {
    w.dataLayer = w.dataLayer || [];
    // gtag.js only reads real `arguments` objects, not arrays.
    w.gtag = function () {
      // eslint-disable-next-line prefer-rest-params
      w.dataLayer!.push(arguments);
    } as Fn;
    w.gtag('js', new Date());
    w.gtag('config', googleAnalyticsId);
    script(`https://www.googletagmanager.com/gtag/js?id=${encodeURIComponent(googleAnalyticsId)}`);
  }
}

/** Reports a commerce event to whichever tools are loaded. */
export function track(event: 'AddToCart' | 'InitiateCheckout' | 'ViewContent', data: { value: number; currency?: string }) {
  const w = window as W;
  const payload = { currency: 'EUR', ...data };
  w.fbq?.('track', event, payload);
  w.gtag?.('event', { AddToCart: 'add_to_cart', InitiateCheckout: 'begin_checkout', ViewContent: 'view_item' }[event], payload);
}
