import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C } from "./lib";

/** Produits du manège, dans l'ordre de passage devant la caméra. */
const ITEMS = [
  { src: "balle.jpg", label: "Balle à friandises" },
  { src: "igloo.jpg", label: "Panier igloo" },
  { src: "harnais.jpg", label: "Harnais réfléchissant" },
  { src: "puzzle.jpg", label: "Puzzle de chasse" },
  { src: "distributeur.jpg", label: "Distributeur eau et croquettes" },
  { src: "brosse.jpg", label: "Brosse autonettoyante" },
  { src: "panier-rond.jpg", label: "Panier rond tout doux" },
  { src: "garnir.jpg", label: "Balles à garnir" },
  { src: "gant.jpg", label: "Gant de toilettage" },
  { src: "litiere.jpg", label: "Tapis de litière" },
];

const FPS = 30;
const HOOK = 75; // 2,5 s
const STEP = 24; // 0,8 s par produit
const SPIN = ITEMS.length * STEP; // 8 s
const END = 120; // 4 s
export const CARROUSEL_DURATION = HOOK + SPIN + END - 15;

const out = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** Mise en page selon le format (vertical, carré, paysage). */
const useLayout = () => {
  const { width, height } = useVideoConfig();
  if (height > width) return { kind: "v", titleTop: 250, titleSize: 96, cy: 1000, card: 540, rx: 400, ry: 110, label: 1500, labelSize: 64, hook: 124, end: 112 };
  if (width > height) return { kind: "h", titleTop: 70, titleSize: 86, cy: 560, card: 400, rx: 620, ry: 70, label: 905, labelSize: 56, hook: 128, end: 116 };
  return { kind: "s", titleTop: 60, titleSize: 74, cy: 540, card: 380, rx: 330, ry: 70, label: 905, labelSize: 50, hook: 104, end: 96 };
};

const Backdrop: React.FC = () => {
  const { width, height } = useVideoConfig();
  const m = Math.max(width, height);
  return (
    <AbsoluteFill style={{ backgroundColor: C.sun, overflow: "hidden" }}>
      <div style={{ position: "absolute", width: m * 0.55, height: m * 0.55, borderRadius: "50%", background: "#ffd166", right: -m * 0.18, top: -m * 0.16 }} />
      <div style={{ position: "absolute", width: m * 0.45, height: m * 0.45, borderRadius: "50%", background: "#ffa94d", left: -m * 0.2, bottom: -m * 0.18, opacity: 0.55 }} />
    </AbsoluteFill>
  );
};

const Brand: React.FC<{ size?: number }> = ({ size = 44 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: size * 0.35, fontFamily: "Bricolage", fontWeight: 800, fontSize: size, color: C.ink, letterSpacing: "-0.02em" }}>
    <Img src={staticFile("logo.png")} style={{ width: size * 1.3, height: size * 1.3, borderRadius: size * 0.3 }} />
    Pattoune
  </div>
);

/** Accroche « POV » : les mots montent un à un. */
const Hook: React.FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const words = ["tu", "cherches", "tout", "pour", "ton", "chat", "et", "ton", "chien"];
  const size = L.hook;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", padding: "0 90px" }}>
      <div
        style={{
          fontFamily: "Figtree",
          fontWeight: 900,
          fontSize: size * 0.55,
          color: "#fff",
          background: C.ink,
          padding: "10px 34px 14px",
          borderRadius: 99,
          marginBottom: 34,
          opacity: interpolate(frame, [0, 6], [0, 1], clamp),
          scale: interpolate(frame, [0, 12], [0.6, 1], { ...clamp, easing: out }),
        }}
      >
        POV&nbsp;:
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", justifyContent: "center", gap: "4px 24px", maxWidth: L.kind === "h" ? 1500 : 940 }}>
        {words.map((w, i) => {
          const t0 = 8 + i * 3;
          const hl = w === "chat" || w === "chien";
          return (
            <span
              key={i}
              style={{
                fontFamily: "Bricolage",
                fontWeight: 800,
                fontSize: size,
                lineHeight: 1.05,
                letterSpacing: "-0.035em",
                color: C.ink,
                background: hl ? "#fff" : "transparent",
                padding: hl ? "0 18px 6px" : 0,
                borderRadius: 20,
                opacity: interpolate(frame, [t0, t0 + 5], [0, 1], clamp),
                translate: interpolate(frame, [t0, t0 + 10], ["0px 50px", "0px 0px"], { ...clamp, easing: out }),
              }}
            >
              {w}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Manège : les cartes sont posées sur un anneau vu de face (projection calculée à la main,
 * plus fiable qu'une vraie scène CSS 3D au rendu). Il avance d'un cran par produit.
 */
const Ring: React.FC = () => {
  const frame = useCurrentFrame();
  const { width } = useVideoConfig();
  const L = useLayout();
  const n = ITEMS.length;
  const stepAngle = 360 / n;

  // Position de l'anneau : chaque cran dure STEP images, dont 9 de mouvement.
  const k = Math.floor(frame / STEP);
  const local = frame - k * STEP;
  const move = interpolate(local, [0, 9], [0, 1], { ...clamp, easing: inOut });
  const pos = k === 0 ? 0 : k - 1 + move; // le premier produit reste face caméra au début
  const theta = -pos * stepAngle;
  const front = ((Math.round(pos) % n) + n) % n;

  const enter = interpolate(frame, [0, 14], [0, 1], { ...clamp, easing: out });

  const cards = ITEMS.map((it, i) => {
    const a = ((i * stepAngle + theta) * Math.PI) / 180;
    const depth = Math.cos(a); // 1 = devant, -1 = derrière
    const x = Math.sin(a) * L.rx;
    const near = (depth + 1) / 2; // 0 = au fond, 1 = devant
    const s = 0.42 + 0.58 * near * near;
    const y = (depth - 1) * L.ry; // le fond du manège est plus haut : on le voit d'un peu au-dessus
    const fade = interpolate(depth, [-1, -0.55], [0, 1], clamp);
    return { it, i, x, y, depth, s, fade, rot: Math.sin(a) * -42 };
  }).sort((p, q) => p.depth - q.depth);

  const labelIn = interpolate(local, [6, 14], [0, 1], { ...clamp, easing: out });

  return (
    <AbsoluteFill>
      <div
        style={{
          position: "absolute",
          top: L.titleTop,
          width: "100%",
          textAlign: "center",
          fontFamily: "Bricolage",
          fontWeight: 800,
          fontSize: L.titleSize,
          letterSpacing: "-0.03em",
          color: C.ink,
          opacity: enter,
        }}
      >
        Tout est chez Pattoune
      </div>
      {cards.map(({ it, i, x, y, depth, s, fade, rot }) => (
        <div
          key={i}
          style={{
            position: "absolute",
            left: width / 2 + x - L.card / 2,
            top: L.cy - L.card / 2 + y,
            opacity: fade,
            width: L.card,
            height: L.card,
            borderRadius: L.card * 0.1,
            overflow: "hidden",
            backgroundColor: "#fff",
            boxShadow: `0 ${30 * s}px ${70 * s}px rgba(20,22,43,${0.12 + 0.2 * s})`,
            transform: `perspective(1400px) rotateY(${rot}deg) scale(${s * enter})`,
            filter: `brightness(${0.55 + 0.45 * ((depth + 1) / 2)})`,
            outline: i === front ? `${Math.round(L.card * 0.025)}px solid #fff` : "none",
          }}
        >
          <Img src={staticFile(it.src)} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        </div>
      ))}
      <div style={{ position: "absolute", top: L.label, width: "100%", display: "flex", justifyContent: "center" }}>
        <div
          style={{
            fontFamily: "Figtree",
            fontWeight: 800,
            fontSize: L.labelSize,
            color: "#fff",
            background: C.ink,
            padding: `${L.labelSize * 0.3}px ${L.labelSize * 0.75}px`,
            borderRadius: 99,
            opacity: enter * labelIn,
            translate: `0px ${(1 - labelIn) * 30}px`,
          }}
        >
          {ITEMS[front].label}
        </div>
      </div>
    </AbsoluteFill>
  );
};

const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const L = useLayout();
  const t = (d: number) => interpolate(frame, [d, d + 12], [0, 1], { ...clamp, easing: out });
  const big = L.end;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", textAlign: "center", gap: 30 }}>
      <div style={{ opacity: t(0), scale: 0.8 + 0.2 * t(0) }}>
        <Brand size={L.end * 0.7} />
      </div>
      <div style={{ fontFamily: "Bricolage", fontWeight: 800, fontSize: big, lineHeight: 1.05, letterSpacing: "-0.035em", color: C.ink, opacity: t(6), translate: `0px ${(1 - t(6)) * 40}px` }}>
        Livraison offerte
        <br />
        dès 25&nbsp;€
      </div>
      <div style={{ fontFamily: "Figtree", fontWeight: 700, fontSize: big * 0.38, color: C.ink, opacity: t(12) * 0.85 }}>
        France, UE et Suisse · colis suivi
      </div>
      <div
        style={{
          fontFamily: "Figtree",
          fontWeight: 800,
          fontSize: big * 0.42,
          color: "#fff",
          background: C.ink,
          padding: `${big * 0.18}px ${big * 0.5}px`,
          borderRadius: 99,
          opacity: t(18),
          scale: 0.85 + 0.15 * t(18),
        }}
      >
        pattounejouets.com
      </div>
    </AbsoluteFill>
  );
};

export const Carrousel: React.FC = () => {
  const frame = useCurrentFrame();
  const fadeHook = interpolate(frame, [HOOK - 18, HOOK - 8], [1, 0], clamp);
  const ringStart = HOOK - 8;
  const endStart = ringStart + SPIN - 5;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Audio src={staticFile("musique.m4a")} volume={0.85} />
      <Sequence durationInFrames={HOOK} name="Accroche POV">
        <AbsoluteFill style={{ opacity: fadeHook }}>
          <Hook />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={ringStart} durationInFrames={SPIN + 5} name="Manège">
        <AbsoluteFill style={{ opacity: interpolate(frame, [endStart, endStart + 10], [1, 0], clamp) }}>
          <Ring />
        </AbsoluteFill>
      </Sequence>
      <Sequence from={endStart} name="Fin">
        <EndCard />
      </Sequence>
    </AbsoluteFill>
  );
};

export const CARROUSEL_FPS = FPS;
