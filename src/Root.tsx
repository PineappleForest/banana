import React from "react";
import { Composition } from "remotion";
import { ThanksgivingShort, THANKSGIVING_FRAMES } from "./videos/thanksgiving/Thanksgiving";
import { PetRockShort, PETROCK_FRAMES } from "./videos/petrock/PetRock";
import { PenguinShort, PENGUIN_FRAMES } from "./videos/penguin/Penguin";
import { RoverShort, ROVER_FRAMES } from "./videos/rover/Rover";
export const Root: React.FC = () => (<>
  <Composition id="ThanksgivingShort" component={ThanksgivingShort} durationInFrames={THANKSGIVING_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="PetRockShort" component={PetRockShort} durationInFrames={PETROCK_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="PenguinShort" component={PenguinShort} durationInFrames={PENGUIN_FRAMES} fps={30} width={1080} height={1920} />
  <Composition id="RoverShort" component={RoverShort} durationInFrames={ROVER_FRAMES} fps={30} width={1080} height={1920} />
</>);
