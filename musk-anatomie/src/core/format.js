// Format de sortie : « landscape » (1920×1080, par défaut) ou « portrait » (1080×1920, TikTok / Reels / Shorts).
// Le format portrait est activé par tiktok.html (généré par le build) via window.MUSK_FORMAT = "portrait".
export const FORMAT = (typeof window !== "undefined" && window.MUSK_FORMAT) || "landscape";
export const PORTRAIT = FORMAT === "portrait";
export const W = PORTRAIT ? 1080 : 1920;
export const H = PORTRAIT ? 1920 : 1080;
