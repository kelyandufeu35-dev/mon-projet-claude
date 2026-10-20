import { loadFont } from "@remotion/fonts";
import { Video } from "@remotion/media";
import React from "react";
import {
  AbsoluteFill,
  Easing,
  Img,
  Interactive,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from "remotion";

loadFont({ family: "Bricolage", url: staticFile("bricolage-latin.woff2"), weight: "200 800" });
loadFont({ family: "Figtree", url: staticFile("figtree-latin.woff2"), weight: "300 900" });

export const C = {
  ink: "#14162b",
  paper: "#f4ece2",
  sun: "#ffc23a",
  red: "#e3261b",
  pop: "#ff7aa8",
  mint: "#4fd1a5",
  cobalt: "#2338e8",
};

const spring = Easing.bezier(0.16, 1, 0.3, 1);

/** Une ligne de sous-titre : les mots apparaissent un à un ; `hl` = mots surlignés en jaune. */
export const Caption: React.FC<{ words: string[]; hl?: number[]; delay?: number; size?: number; top?: number; dark?: boolean }> = ({
  words,
  hl = [],
  delay = 6,
  size = 96,
  top = 300,
  dark = false,
}) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ top, height: "auto", padding: "0 80px", display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", alignContent: "flex-start", gap: "6px 22px" }}>
      {words.map((w, i) => {
        const t0 = delay + i * 4;
        const on = hl.includes(i);
        return (
          <span
            key={i}
            style={{
              fontFamily: "Bricolage",
              fontWeight: 800,
              fontSize: size,
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: on || dark ? C.ink : "#fff",
              background: on ? C.sun : "transparent",
              padding: on ? "0 18px 6px" : 0,
              borderRadius: 18,
              textShadow: on || dark ? "none" : "0 6px 28px rgba(0,0,0,.55)",
              opacity: interpolate(frame, [t0, t0 + 5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
              translate: interpolate(frame, [t0, t0 + 10], ["0px 60px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }),
              scale: interpolate(frame, [t0, t0 + 10], [0.7, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }),
              rotate: on ? interpolate(frame, [t0, t0 + 12], ["-6deg", "-2deg"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }) : "0deg",
            }}
          >
            {w}
          </span>
        );
      })}
    </AbsoluteFill>
  );
};

/** Petite étiquette (étape, détail) sous le sous-titre. */
export const Pill: React.FC<{ children: React.ReactNode; top: number; delay?: number; bg?: string }> = ({ children, top, delay = 14, bg = C.paper }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ top, height: "auto", display: "flex", justifyContent: "center", alignItems: "center" }}>
      <Interactive.Div
        name="Étiquette"
        style={{
          fontFamily: "Figtree",
          fontWeight: 800,
          fontSize: 46,
          color: C.ink,
          background: bg,
          padding: "18px 38px",
          borderRadius: 99,
          boxShadow: "0 14px 40px rgba(0,0,0,.25)",
          opacity: interpolate(frame, [delay, delay + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          scale: interpolate(frame, [delay, delay + 12], [0.6, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }),
        }}
      >
        {children}
      </Interactive.Div>
    </AbsoluteFill>
  );
};

/** Dégradé sombre en haut de l'image, pour lire le texte blanc. */
const Shade: React.FC = () => (
  <AbsoluteFill style={{ background: "linear-gradient(rgba(10,10,18,.62) 0%, rgba(10,10,18,.25) 38%, transparent 55%, transparent 80%, rgba(10,10,18,.35) 100%)" }} />
);

/** Photo plein écran avec zoom lent ; `x`/`y` = point de cadrage (en %). */
export const Photo: React.FC<{ src: string; x?: number; y?: number; from?: number; to?: number; children?: React.ReactNode }> = ({ src, x = 50, y = 50, from = 1.0, to = 1.12, children }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <AbsoluteFill style={{ backgroundColor: C.ink }}>
      <Img
        name="Photo"
        src={staticFile(src)}
        style={{
          width: "100%",
          height: "100%",
          objectFit: "cover",
          objectPosition: `${x}% ${y}%`,
          scale: interpolate(frame, [0, durationInFrames], [from, to], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
        }}
      />
      <Shade />
      {children}
    </AbsoluteFill>
  );
};

/** Vidéo plein écran (muette). */
export const Clip: React.FC<{ src: string; children?: React.ReactNode; trim?: number }> = ({ src, children, trim = 0 }) => (
  <AbsoluteFill style={{ backgroundColor: C.ink }}>
    <Video name="Clip" src={staticFile(src)} muted trimBefore={trim} objectFit="cover" style={{ width: "100%", height: "100%" }} />
    <Shade />
    {children}
  </AbsoluteFill>
);

/** Grille de couleurs sur fond crème. */
export const Colors: React.FC<{ items: { src: string; label: string }[]; cols: number; title: string[]; hl?: number[] }> = ({ items, cols, title, hl }) => {
  const frame = useCurrentFrame();
  const cell = cols === 2 ? 430 : 270;
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <Caption words={title} hl={hl} top={250} delay={2} size={100} dark />
      <AbsoluteFill style={{ top: 520, height: "auto", display: "flex", flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: 26, padding: "0 70px" }}>
        {items.map((it, i) => {
          const t0 = 10 + i * 3;
          return (
            <div
              key={it.src}
              style={{
                width: cell,
                opacity: interpolate(frame, [t0, t0 + 6], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
                translate: interpolate(frame, [t0, t0 + 12], ["0px 80px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }),
              }}
            >
              <Img src={staticFile(it.src)} style={{ width: cell, height: cell, objectFit: "cover", borderRadius: 34, backgroundColor: "#fff", boxShadow: "0 18px 40px rgba(20,22,43,.14)" }} />
              <div style={{ fontFamily: "Figtree", fontWeight: 800, fontSize: cols === 2 ? 40 : 32, color: C.ink, textAlign: "center", marginTop: 12 }}>{it.label}</div>
            </div>
          );
        })}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/** Produit seul sur fond crème, avec texte sombre. */
export const ProductCard: React.FC<{ src: string; words: string[]; hl?: number[]; pill?: string }> = ({ src, words, hl, pill }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: C.paper }}>
      <Caption words={words} hl={hl} top={250} delay={2} dark />
      <AbsoluteFill style={{ top: 560, height: "auto", display: "flex", justifyContent: "flex-start", alignItems: "center" }}>
        <Img
          name="Produit"
          src={staticFile(src)}
          style={{
            width: 820,
            height: 820,
            objectFit: "cover",
            borderRadius: 48,
            boxShadow: "0 30px 70px rgba(20,22,43,.16)",
            scale: interpolate(frame, [4, 20], [0.85, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring, output: "perceptual-scale" }),
            opacity: interpolate(frame, [4, 12], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
          }}
        />
      </AbsoluteFill>
      {pill ? <Pill top={1440} delay={18} bg={C.sun}>{pill}</Pill> : null}
    </AbsoluteFill>
  );
};

/** Écran de fin jaune : logo, nom du produit, livraison. */
export const EndCard: React.FC<{ product: string }> = ({ product }) => {
  const frame = useCurrentFrame();
  const pop = (t: number) => ({
    opacity: interpolate(frame, [t, t + 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
    translate: interpolate(frame, [t, t + 14], ["0px 50px", "0px 0px"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }),
  });
  return (
    <AbsoluteFill style={{ backgroundColor: C.sun, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 34 }}>
      <AbsoluteFill style={{ background: "radial-gradient(circle at 85% 8%, rgba(255,255,255,.35) 0 18%, transparent 18.2%), radial-gradient(circle at 8% 92%, rgba(255,122,168,.35) 0 20%, transparent 20.2%)" }} />
      <Img
        name="Logo"
        src={staticFile("logo.png")}
        style={{
          width: 230,
          height: 230,
          borderRadius: 56,
          boxShadow: "0 20px 50px rgba(20,22,43,.22)",
          scale: interpolate(frame, [0, 14], [0.5, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring, output: "perceptual-scale" }),
          rotate: interpolate(frame, [0, 14], ["-12deg", "0deg"], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: spring }),
        }}
      />
      <div style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: 130, letterSpacing: "-0.04em", color: C.ink, lineHeight: 1, ...pop(5) }}>Pattoune</div>
      <div style={{ fontFamily: "Figtree", fontWeight: 700, fontSize: 50, color: C.ink, textAlign: "center", padding: "0 90px", lineHeight: 1.2, ...pop(10) }}>{product}</div>
      <div style={{ marginTop: 26, fontFamily: "Figtree", fontWeight: 800, fontSize: 46, color: "#fff", background: C.ink, padding: "24px 44px", borderRadius: 99, ...pop(16) }}>Livraison offerte dès 25 €</div>
      <div style={{ fontFamily: "Figtree", fontWeight: 700, fontSize: 44, color: C.ink, ...pop(22) }}>Lien dans la bio ↗</div>
    </AbsoluteFill>
  );
};
