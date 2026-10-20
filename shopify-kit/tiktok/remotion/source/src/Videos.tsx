import { linearTiming, springTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { slide } from "@remotion/transitions/slide";
import React from "react";
import { Sequence } from "remotion";
import { C, Caption, Clip, Colors, EndCard, Photo, Pill, ProductCard } from "./lib";

const T = 10; // durée d'une transition (images)
const up = () => <TransitionSeries.Transition presentation={slide({ direction: "from-bottom" })} timing={springTiming({ config: { damping: 200 }, durationInFrames: T })} />;
const fadeT = () => <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: T })} />;

/* ---------- 1. Balle à friandises ---------- */
export const BALLE_DURATION = 90 + 75 + 120 + 75 + 90 - 4 * T;
export const Balle: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Accroche" durationInFrames={90}>
      <Clip src="pt-hero-loop.webm">
        <Caption words={["Transforme", "ses", "croquettes", "en", "jeu"]} hl={[4]} top={280} size={104} />
      </Clip>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Remplis" durationInFrames={75}>
      <Photo src="b-croquettes.jpg" y={55}>
        <Caption words={["Remplis-la", "de", "croquettes"]} hl={[0]} />
        <Pill top={640}>1 · Remplis</Pill>
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Elle roule" durationInFrames={120}>
      <Clip src="pt-roule.webm">
        <Sequence durationInFrames={62} layout="none">
          <Caption words={["Il", "la", "pousse,", "elle", "roule"]} hl={[4]} />
          <Pill top={640}>2 · Il joue</Pill>
        </Sequence>
        <Sequence from={62} layout="none">
          <Caption words={["Les", "croquettes", "tombent", "une", "à", "une"]} hl={[1]} delay={2} />
          <Pill top={760} delay={10}>3 · Récompense</Pill>
        </Sequence>
      </Clip>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Taille" durationInFrames={75}>
      <Photo src="b-8cm.jpg" y={45} from={1.05} to={1.0}>
        <Caption words={["8", "cm,", "caoutchouc", "souple"]} hl={[0, 1]} />
        <Pill top={660} bg={C.sun}>Chat et petit chien</Pill>
      </Photo>
    </TransitionSeries.Sequence>
    {fadeT()}
    <TransitionSeries.Sequence name="Fin" durationInFrames={90}>
      <EndCard product="Balle à friandises" />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

/* ---------- 2. Panier igloo ---------- */
export const IGLOO_DURATION = 90 + 75 + 75 + 90 + 75 + 90 - 5 * T;
export const Igloo: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Accroche" durationInFrames={90}>
      <Photo src="i-rose-chat.jpg" x={45} y={55}>
        <Caption words={["Ton", "chat", "adore", "se", "cacher", "?"]} hl={[3, 4]} top={280} size={110} />
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Abri" durationInFrames={75}>
      <Photo src="i-q4.jpg" y={55}>
        <Caption words={["Couverture", "rabattue", ":", "un", "petit", "abri"]} hl={[4, 5]} />
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Douceur" durationInFrames={75}>
      <Photo src="i-q3.jpg" y={55}>
        <Caption words={["Peluche", "longue,", "doublure", "douce"]} hl={[0]} />
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Couleurs" durationInFrames={90}>
      <Colors
        title={["3", "couleurs"]}
        hl={[0]}
        cols={2}
        items={[
          { src: "i-gris.jpg", label: "Gris foncé" },
          { src: "i-rose.jpg", label: "Rose" },
          { src: "i-beige.jpg", label: "Blanc et brun" },
        ]}
      />
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Détails" durationInFrames={75}>
      <ProductCard src="i-gris.jpg" words={["40", "cm,", "dessous", "antidérapant"]} hl={[0, 1]} pill="Chat ou petit chien" />
    </TransitionSeries.Sequence>
    {fadeT()}
    <TransitionSeries.Sequence name="Fin" durationInFrames={90}>
      <EndCard product="Panier igloo en peluche" />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);

/* ---------- 3. Harnais réfléchissant ---------- */
export const HARNAIS_DURATION = 90 + 75 + 75 + 90 + 75 + 90 - 5 * T;
export const Harnais: React.FC = () => (
  <TransitionSeries>
    <TransitionSeries.Sequence name="Accroche" durationInFrames={90}>
      <Photo src="h-noir.jpg" y={40}>
        <Caption words={["Le", "harnais", "des", "balades", "du", "soir"]} hl={[4, 5]} top={280} size={108} />
        <Pill top={720} delay={22} bg={C.sun}>Bandes réfléchissantes</Pill>
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Réglage" durationInFrames={75}>
      <Photo src="h-golden.jpg" y={45}>
        <Caption words={["4", "points", "de", "réglage"]} hl={[0]} />
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Poignée" durationInFrames={75}>
      <Photo src="h-poignee.jpg" y={50}>
        <Caption words={["Une", "poignée", "sur", "le", "dos"]} hl={[1]} />
      </Photo>
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Couleurs" durationInFrames={90}>
      <Colors
        title={["8", "couleurs"]}
        hl={[0]}
        cols={3}
        items={[
          { src: "h-05-noir.jpg", label: "Noir" },
          { src: "h-06-rouge.jpg", label: "Rouge" },
          { src: "h-07-bleu.jpg", label: "Bleu" },
          { src: "h-08-vert-fluo.jpg", label: "Vert fluo" },
          { src: "h-09-orange.jpg", label: "Orange" },
          { src: "h-10-rose-clair.jpg", label: "Rose clair" },
          { src: "h-11-fuchsia.jpg", label: "Fuchsia" },
          { src: "h-12-violet.jpg", label: "Violet" },
        ]}
      />
    </TransitionSeries.Sequence>
    {up()}
    <TransitionSeries.Sequence name="Tailles" durationInFrames={75}>
      <Photo src="h-labrador.jpg" y={40}>
        <Caption words={["Du", "S", "au", "XL"]} hl={[1, 3]} />
        <Pill top={640} bg={C.sun}>De 4 à 50 kg environ</Pill>
      </Photo>
    </TransitionSeries.Sequence>
    {fadeT()}
    <TransitionSeries.Sequence name="Fin" durationInFrames={90}>
      <EndCard product="Harnais réglable réfléchissant" />
    </TransitionSeries.Sequence>
  </TransitionSeries>
);
