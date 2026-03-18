import React from "react";
import { Circle } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { ORBIT_R, PLASMA_COLORS } from "../_shared/constants";
import { cos, sin, atan2, PI } from "../_shared/helpers";
import { SkSprite } from "./SkSprite";


interface SatelliteRendererProps {
  s: GameState;
  ts: number;
  ex: number;
  ey: number;
  imgSatellite: SkImage | null;
  imgSatGold: SkImage | null;
  imgPhotonBlue: SkImage | null;
}

export const SatelliteRenderer = React.memo(({ s, ts, ex, ey, imgSatellite, imgSatGold, imgPhotonBlue }: SatelliteRendererProps) => (
  <>
    {/* Satellites */}
    {s.satellites.map((sat) => {
      const sx = ex + cos(sat.angle) * ORBIT_R;
      const sy = ey + sin(sat.angle) * ORBIT_R;
      const rotDeg = (ts * 0.03) % 360;
      const rotRad = rotDeg * PI / 180;
      const satImg = s.immortal ? imgSatGold : imgSatellite;
      return (
        <React.Fragment key={sat.id}>
          {sat.shieldActive && (
            <Circle cx={sx} cy={sy} r={18} color="rgba(108,92,231,0.08)" style="fill" />
          )}
          {sat.shieldActive && (
            <Circle cx={sx} cy={sy} r={18} color="rgba(162,155,254,0.5)" style="stroke" strokeWidth={1.5} />
          )}
          <SkSprite img={satImg} cx={sx} cy={sy} w={28} h={28} angle={rotRad} />
        </React.Fragment>
      );
    })}

    {/* Satellite bullets */}
    {s.satBullets.map((sb) => {
      const sbAngle = atan2(sb.vy, sb.vx) + PI / 2;
      return <SkSprite key={sb.id} img={imgPhotonBlue} cx={sb.x} cy={sb.y} w={20} h={42} angle={sbAngle} opacity={0.7} tint={PLASMA_COLORS[s.laserColor]?.rgb} />;
    })}
  </>
));
