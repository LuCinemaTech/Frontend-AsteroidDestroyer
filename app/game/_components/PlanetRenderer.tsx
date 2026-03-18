import React from "react";
import {
  Image as SkiaImage,
  Circle,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { PLANET_R, ORBIT_R } from "../_shared/constants";
import { getPlanetForLevel, PLANET_ATMO, min, max } from "../_shared/helpers";

interface PlanetRendererProps {
  s: GameState;
  ts: number;
  ex: number;
  ey: number;
  flashOpacity: number;
  planetImageMap: Record<string, (SkImage | null)[]>;
  imgEarth: (SkImage | null)[];
  imgEarthGold: SkImage | null;
}

export const PlanetRenderer = React.memo(({ s, ts, ex, ey, flashOpacity, planetImageMap, imgEarth, imgEarthGold }: PlanetRendererProps) => {
  if (s.planetExploded) return null;

  const eScale = s.immortal ? 2.1 : 1.8;
  const activePlanet = s.travelPhase === 'arriving'
    ? getPlanetForLevel(s.level + 1)
    : getPlanetForLevel(s.level);
  const imgs = planetImageMap[activePlanet] ?? imgEarth;
  const stageIdx = min(imgs.length - 1, max(0, s.planetStage - 1));
  const eImg = s.immortal ? imgEarthGold : (imgs[stageIdx] ?? imgs[0]);
  const eR = PLANET_R * eScale;
  const atmoColors = PLANET_ATMO[activePlanet] ?? PLANET_ATMO.earth;

  return (
    <>
      {/* Orbit ring */}
      {!s.travelPhase && <Circle cx={ex} cy={ey} r={ORBIT_R} color="transparent" style="stroke" strokeWidth={1} opacity={0.08} />}

      {/* Atmosphere glow */}
      <Circle cx={ex} cy={ey} r={PLANET_R * 2} color={atmoColors[0]} opacity={0.3} />
      {eImg && <SkiaImage image={eImg} x={ex - eR} y={ey - eR} width={eR * 2} height={eR * 2} fit="cover" />}
      {flashOpacity > 0 && (
        <Circle cx={ex} cy={ey} r={PLANET_R * 1.4} color="white" opacity={flashOpacity} />
      )}

      {/* Planet shield */}
      {s.planetShield && (
        <>
          <Circle cx={ex} cy={ey} r={ORBIT_R} color="rgba(108,92,231,0.08)" />
          <Circle cx={ex} cy={ey} r={ORBIT_R} color="rgba(108,92,231,0.6)" style="stroke" strokeWidth={2} />
        </>
      )}
    </>
  );
});
