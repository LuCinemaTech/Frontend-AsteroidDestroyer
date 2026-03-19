import React from "react";
import { Circle } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { POWER_R } from "../_shared/constants";
import { SkSprite } from "./SkSprite";

interface ParticlesRendererProps {
  s: GameState;
  ts: number;
  imgDebris: (SkImage | null)[];
  imgPower: Record<string, SkImage | null>;
  astImgMap: Record<string, (SkImage | null)[]>;
  imgBrownAst: (SkImage | null)[];
}

export const ParticlesRenderer = React.memo(({ s, ts, imgDebris, imgPower, astImgMap, imgBrownAst }: ParticlesRendererProps) => (
  <>
    {/* Particles */}
    {s.particles.map((p) => (
      <Circle key={p.id} cx={p.x} cy={p.y} r={2} color={p.color} opacity={p.life} />
    ))}

    {/* Debris */}
    {s.debris.map((d) => {
      const sz = d.radius * 2;
      if (d.isMetal) {
        const img = imgDebris[d.sprite % imgDebris.length];
        return <SkSprite key={d.id} img={img} cx={d.x} cy={d.y} w={sz} h={sz} angle={d.rotation} opacity={d.life} />;
      }
      const imgs = astImgMap[d.asteroidType ?? 'brown'] ?? imgBrownAst;
      const img = imgs[d.sprite % imgs.length];
      return <SkSprite key={d.id} img={img} cx={d.x} cy={d.y} w={sz} h={sz} angle={d.rotation} opacity={d.life} />;
    })}

    {/* Power-ups */}
    {s.powerUps.map((p) => (
      <SkSprite key={p.id} img={imgPower[p.type]} cx={p.x} cy={p.y} w={POWER_R * 2} h={POWER_R * 2} />
    ))}
  </>
));
