import React from "react";
import {
  Circle,
  Line,
  vec,
} from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { SHIELD_R, BUMPER_R } from "../_shared/constants";
import { cos, sin, PI, PI2 } from "../_shared/helpers";

interface ShieldRendererProps {
  s: GameState;
  ts: number;
  px: number;
  py: number;
  pa: number;
}

export const ShieldRenderer = React.memo(({ s, ts, px, py, pa }: ShieldRendererProps) => {
  if (s.shipDestroyed) return null;

  return (
    <>
      {/* Shield forcefield */}
      {s.shieldActive > 0 && (() => {
        const pulse = Math.sin(ts * 0.005) * 0.5 + 0.5;
        const sr = SHIELD_R;
        const hexCount = 12;
        const ringR = sr * 0.7;
        const elements: React.ReactNode[] = [];

        elements.push(<Circle key="sf-outer" cx={px} cy={py} r={sr * 1.3} color="transparent" style="stroke" strokeWidth={1.5} opacity={0.3 + pulse * 0.3} />);
        elements.push(<Circle key="sf-inner" cx={px} cy={py} r={sr} color="rgba(108,92,231,0.08)" opacity={0.6 + pulse * 0.4} />);

        for (let i = 0; i < hexCount; i++) {
          const a = (PI2 / hexCount) * i + ts * 0.001;
          const nx = px + cos(a) * ringR;
          const ny = py + sin(a) * ringR;
          const nodeSize = 3 + pulse * 1.5;
          elements.push(<Circle key={`sf-n-${i}`} cx={nx} cy={ny} r={nodeSize / 2} color={`rgba(162,155,254,${(0.5 + pulse * 0.4).toFixed(2)})`} />);

          const a2 = (PI2 / hexCount) * (i + 1) + ts * 0.001;
          const nx2 = px + cos(a2) * ringR;
          const ny2 = py + sin(a2) * ringR;
          elements.push(
            <Line key={`sf-l-${i}`} p1={vec(nx, ny)} p2={vec(nx2, ny2)} color={`rgba(162,155,254,${(0.25 + pulse * 0.2).toFixed(2)})`} strokeWidth={1.5} />
          );
        }

        for (let i = 0; i < 3; i++) {
          const arcA = (PI2 / 3) * i + ts * 0.002 + i * 1.2;
          const ax1 = px + cos(arcA) * (sr * 0.4);
          const ay1 = py + sin(arcA) * (sr * 0.4);
          const ax2 = px + cos(arcA + 0.5) * (sr * 0.95);
          const ay2 = py + sin(arcA + 0.5) * (sr * 0.95);
          elements.push(
            <Line key={`sf-a-${i}`} p1={vec(ax1, ay1)} p2={vec(ax2, ay2)} color={`rgba(200,200,255,${(0.3 + pulse * 0.35).toFixed(2)})`} strokeWidth={1} />
          );
        }

        return <>{elements}</>;
      })()}

      {/* Bumper shield */}
      {s.bumperActive && (() => {
        const br = BUMPER_R;
        const flash = Math.sin(ts * 0.02) * 0.3 + 0.7;
        const elements: React.ReactNode[] = [];
        const ARC_HALF = PI / 3;
        const SEGS = 16;

        for (let i = 0; i < SEGS; i++) {
          const a1 = pa - ARC_HALF + (i / SEGS) * ARC_HALF * 2;
          const a2 = pa - ARC_HALF + ((i + 1) / SEGS) * ARC_HALF * 2;
          elements.push(
            <Line key={`bp-a-${i}`}
              p1={vec(px + cos(a1) * br, py + sin(a1) * br)}
              p2={vec(px + cos(a2) * br, py + sin(a2) * br)}
              color={`rgba(0,255,136,${(0.7 * flash).toFixed(2)})`} strokeWidth={3} />
          );
        }

        for (let i = 0; i < SEGS; i++) {
          const a1 = pa - ARC_HALF + (i / SEGS) * ARC_HALF * 2;
          const a2 = pa - ARC_HALF + ((i + 1) / SEGS) * ARC_HALF * 2;
          const r2 = br * 1.2;
          elements.push(
            <Line key={`bp-g-${i}`}
              p1={vec(px + cos(a1) * r2, py + sin(a1) * r2)}
              p2={vec(px + cos(a2) * r2, py + sin(a2) * r2)}
              color="rgba(0,255,136,0.15)" strokeWidth={6} />
          );
        }

        const spokeCount = 5;
        for (let i = 0; i < spokeCount; i++) {
          const a = pa - ARC_HALF + (i / (spokeCount - 1)) * ARC_HALF * 2;
          const ix = px + cos(a) * (br * 0.5);
          const iy = py + sin(a) * (br * 0.5);
          const ox = px + cos(a) * (br * 1.1);
          const oy = py + sin(a) * (br * 1.1);
          elements.push(
            <Line key={`bp-s-${i}`} p1={vec(ix, iy)} p2={vec(ox, oy)}
              color={`rgba(0,255,136,${(0.25 * flash).toFixed(2)})`} strokeWidth={1.5} />
          );
        }

        return <>{elements}</>;
      })()}
    </>
  );
});
