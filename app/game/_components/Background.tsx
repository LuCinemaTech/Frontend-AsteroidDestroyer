import React from "react";
import {
  Image as SkiaImage,
  Circle,
  Rect,
  LinearGradient,
  vec,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { GW, GH, STARS } from "../_shared/constants";

interface BackgroundProps {
  imgBg: SkImage | null;
  s: GameState;
  ts: number;
}

export const Background = React.memo(({ imgBg, s, ts }: BackgroundProps) => (
  <>
    {/* Static background */}
    {imgBg && !s.travelPhase && s.immortalPhase !== 'active' && <SkiaImage image={imgBg} x={0} y={0} width={GW} height={GH} fit="cover" />}

    {/* Scrolling background (travel or immortal active) */}
    {imgBg && (s.travelPhase || s.immortalPhase === 'active') && (() => {
      const off = s.travelBgOffset % GH;
      const seamY = off;
      const FADE = 160;
      return (
        <>
          <SkiaImage image={imgBg} x={0} y={off} width={GW} height={GH} fit="cover" />
          <SkiaImage image={imgBg} x={0} y={off - GH} width={GW} height={GH} fit="cover" />
          <Rect x={0} y={seamY - FADE / 2} width={GW} height={FADE}>
            <LinearGradient
              start={vec(0, seamY - FADE / 2)}
              end={vec(0, seamY + FADE / 2)}
              colors={["rgba(0,0,0,0)", "rgba(0,0,0,0.7)", "rgba(0,0,0,0)"]}
            />
          </Rect>
        </>
      );
    })()}

    {/* Stars */}
    {STARS.map((st, i) => {
      const t1 = Math.sin(ts * st.speed + st.phase);
      const t2 = Math.sin(ts * st.speed2 + st.phase2);
      const twinkle = (t1 * 0.6 + t2 * 0.4) * 0.5 + 0.5;
      const opacity = st.o * (0.1 + twinkle * 0.9);
      const r = st.r * (0.9 + twinkle * 0.2);
      let starY: number;
      if (s.travelPhase === 'arriving') {
        const at = Math.min(1, (ts - s.travelStart) / 3000);
        const ae = at * at * (3 - 2 * at);
        const scrolledY = (st.y + st.r + s.travelBgOffset * (0.5 + st.o)) % GH;
        const staticY = st.y + st.r;
        starY = scrolledY + (staticY - scrolledY) * ae;
      } else if (s.travelPhase || s.immortalPhase === 'active') {
        starY = (st.y + st.r + s.travelBgOffset * (0.5 + st.o)) % GH;
      } else {
        starY = st.y + st.r;
      }
      return <Circle key={i} cx={st.x + st.r} cy={starY} r={r} color={st.c} opacity={opacity} />;
    })}
  </>
));
