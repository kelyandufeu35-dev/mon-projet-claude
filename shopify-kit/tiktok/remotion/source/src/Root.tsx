import { Composition } from "remotion";
import { Carrousel, CARROUSEL_DURATION } from "./Carrousel";
import { Balle, BALLE_DURATION, Harnais, HARNAIS_DURATION, Igloo, IGLOO_DURATION } from "./Videos";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Balle" component={Balle} durationInFrames={BALLE_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Igloo" component={Igloo} durationInFrames={IGLOO_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Harnais" component={Harnais} durationInFrames={HARNAIS_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="CarrouselVertical" component={Carrousel} durationInFrames={CARROUSEL_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="CarrouselCarre" component={Carrousel} durationInFrames={CARROUSEL_DURATION} fps={30} width={1080} height={1080} />
      <Composition id="CarrouselPaysage" component={Carrousel} durationInFrames={CARROUSEL_DURATION} fps={30} width={1920} height={1080} />
    </>
  );
};
