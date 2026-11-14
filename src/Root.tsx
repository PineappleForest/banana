import React from "react";
import { Composition } from "remotion";
import { ThanksgivingShort, THANKSGIVING_FRAMES } from "./videos/thanksgiving/Thanksgiving";
import { PetRockShort, PETROCK_FRAMES } from "./videos/petrock/PetRock";
export const Root: React.FC = () => (<>
  <Composition id="ThanksgivingShort" component={ThanksgivingShort} durationInFrames={THANKSGIVING_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="PetRockShort" component={PetRockShort} durationInFrames={PETROCK_FRAMES} fps={30} width={1080} height={1920} />
</>);
