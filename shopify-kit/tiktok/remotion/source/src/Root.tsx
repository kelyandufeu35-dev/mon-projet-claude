import { Composition } from "remotion";
import { Balle, BALLE_DURATION, Harnais, HARNAIS_DURATION, Igloo, IGLOO_DURATION } from "./Videos";

export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition id="Balle" component={Balle} durationInFrames={BALLE_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Igloo" component={Igloo} durationInFrames={IGLOO_DURATION} fps={30} width={1080} height={1920} />
      <Composition id="Harnais" component={Harnais} durationInFrames={HARNAIS_DURATION} fps={30} width={1080} height={1920} />
    </>
  );
};
