import React from "react";
import {
  Image as SkiaImage,
  Group,
  Paint,
  ColorMatrix,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { ORBIT_R, PLAYER_W, PLAYER_H, PLASMA_COLORS } from "../_shared/constants";
import { cos, sin, PI } from "../_shared/helpers";
import { SkSprite, tintMatrix } from "./SkSprite";

interface PlayerRendererProps {
  s: GameState;
  ts: number;
  px: number;
  py: number;
  pa: number;
  shipImgs: Record<string, SkImage | null>;
  imgShipGold: SkImage | null;
}

export const PlayerRenderer = React.memo(({ s, ts, px, py, pa, shipImgs, imgShipGold }: PlayerRendererProps) => {
  if (s.shipDestroyed) return null;

  return (
    <>
      {/* Wave-active glow behind ship */}
      {s.selectedWeapon === 'wave' && s.waveAmmo > 0 && (() => {
        const pc = PLASMA_COLORS[s.laserColor];
        const gr = pc.rgb[0]; const gg = pc.rgb[1]; const gb = pc.rgb[2];
        const pulse = Math.sin(ts * 0.004) * 0.5 + 0.5;
        const rotRad = pa + PI / 2;
        const layers = [
          { baseScale: 1.2, scaleRange: 0.25, opacity: 0.02 + pulse * 0.15 },
          { baseScale: 1.12, scaleRange: 0.18, opacity: 0.03 + pulse * 0.2 },
          { baseScale: 1.06, scaleRange: 0.1, opacity: 0.05 + pulse * 0.25 },
        ];
        const shipImg = shipImgs[s.shipColor];
        if (!shipImg) return null;
        return (
          <>
            {layers.map((l, i) => {
              const sc = l.baseScale + pulse * l.scaleRange;
              const w = PLAYER_W * 4 * sc;
              const h = PLAYER_H * 4 * sc;
              return (
                <Group key={`glow-${i}`} transform={[{ translateX: px }, { translateY: py }, { rotate: rotRad }, { translateX: -w / 2 }, { translateY: -h / 2 }]} opacity={l.opacity}>
                  <SkiaImage image={shipImg} x={0} y={0} width={w} height={h} fit="contain">
                    <Paint><ColorMatrix matrix={tintMatrix(gr, gg, gb, 0.35)} /></Paint>
                  </SkiaImage>
                </Group>
              );
            })}
          </>
        );
      })()}

      {/* Plasma-selected glow behind ship */}
      {s.selectedWeapon === 'plasma' && s.plasmaAmmo > 0 && (() => {
        const pulse = Math.sin(ts * 0.005) * 0.5 + 0.5;
        const rotRad = pa + PI / 2;
        const layers = [
          { baseScale: 1.2, scaleRange: 0.25, opacity: 0.02 + pulse * 0.12 },
          { baseScale: 1.12, scaleRange: 0.18, opacity: 0.03 + pulse * 0.18 },
          { baseScale: 1.06, scaleRange: 0.1, opacity: 0.04 + pulse * 0.22 },
        ];
        const shipImg = shipImgs[s.shipColor];
        if (!shipImg) return null;
        return (
          <>
            {layers.map((l, i) => {
              const sc = l.baseScale + pulse * l.scaleRange;
              const w = PLAYER_W * 4 * sc;
              const h = PLAYER_H * 4 * sc;
              return (
                <Group key={`pglow-${i}`} transform={[{ translateX: px }, { translateY: py }, { rotate: rotRad }, { translateX: -w / 2 }, { translateY: -h / 2 }]} opacity={l.opacity}>
                  <SkiaImage image={shipImg} x={0} y={0} width={w} height={h} fit="contain">
                    <Paint><ColorMatrix matrix={tintMatrix(0, 255, 200, 0.35)} /></Paint>
                  </SkiaImage>
                </Group>
              );
            })}
          </>
        );
      })()}

      {/* Player ship */}
      {(() => {
        const shipImg = s.immortal ? imgShipGold : shipImgs[s.shipColor];
        const inTravel = !!s.travelPhase;
        const inImmortal = !!s.immortalPhase;
        const shipCX = inImmortal ? s.immortalShipX : inTravel ? s.travelShipX : px;
        const shipCY = inImmortal ? s.immortalShipY : inTravel ? s.travelShipY : py;
        let rotRad: number;
        if (s.immortalPhase === 'departing') {
          const dt = Math.min(1, (ts - s.immortalStart) / 2000);
          const et = dt * dt * (3 - 2 * dt);
          rotRad = s.immortalDepartRot * (1 - et); // eases toward 0 (facing up)
        } else if (s.immortalPhase === 'active') {
          rotRad = 0; // always facing upward
        } else if (inImmortal) {
          rotRad = s.playerAngle + PI / 2;
        } else if (s.travelPhase === 'departing') {
          const dt = Math.min(1, (ts - s.travelStart) / 3000);
          const et = dt * dt * (3 - 2 * dt);
          rotRad = s.travelDepartRot * (1 - et);
        } else if (inTravel) {
          rotRad = 0;
        } else {
          rotRad = pa + PI / 2;
        }
        return <SkSprite img={shipImg} cx={shipCX} cy={shipCY} w={PLAYER_W * 4} h={PLAYER_H * 4} angle={rotRad} />;
      })()}
    </>
  );
});
