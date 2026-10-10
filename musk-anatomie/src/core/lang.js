// Langue de la composition : "fr" (défaut) ou "en". Fixée par la page (window.MUSK_LANG) ; en Node (export de la
// timeline sonore), par la variable d'environnement MUSK_LANG.
const fromPage = typeof window !== "undefined" ? window.MUSK_LANG : undefined;
const fromEnv = typeof process !== "undefined" && process.env ? process.env.MUSK_LANG : undefined;
export const LANG = fromPage || fromEnv || "fr";
export const EN = LANG === "en";

/** ln(fr, en) : le texte de la langue courante. Les deux versions sont écrites côte à côte : rien n'est oublié. */
export const ln = (fr, en) => (EN ? en : fr);

export const LOCALE = EN ? "en-US" : "fr-FR";
/** date ISO -> « 10 oct. 2026 » / « Oct 10, 2026 » */
export const fmtDate = (iso) => new Date(iso + "T12:00:00Z").toLocaleDateString(LOCALE, { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });
