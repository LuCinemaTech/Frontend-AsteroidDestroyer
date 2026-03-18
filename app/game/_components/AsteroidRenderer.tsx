import React from "react";
import { RoundedRect } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { SkSprite } from "./SkSprite";
import { min, max } from "../_shared/helpers";

interface AsteroidRendererProps {
  s: GameState;
  ts: number;
  astImgMap: Record<string, (SkImage | null)[]>;
  imgBrownAst: (SkImage | null)[];
  imgBoss: (SkImage | null)[];
}

export const AsteroidRenderer = React.memo(({ s, ts, astImgMap, imgBrownAst, imgBoss }: AsteroidRendererProps) => (
  <>
    {/* Travel asteroids */}
    {s.travelPhase === 'traveling' && s.travelAsteroids.map((a) => {
      const sz = a.radius * 2;
      const imgs = imgBrownAst;
      const img = imgs[a.sprite % imgs.length];
      return <SkSprite key={a.id} img={img} cx={a.x} cy={a.y} w={sz} h={sz} angle={a.rotation} />;
    })}

    {/* Asteroids (non-boss) */}
    {s.asteroids.filter((a) => !a.isBoss && a.radius > 0).map((a) => {
      const GROW_DUR = 500;
      const growScale = a.growEnd ? Math.max(0.05, 1 - (a.growEnd - ts) / GROW_DUR) : 1;
      const sz = a.radius * 2 * growScale;
      const imgs = astImgMap[a.asteroidType] ?? imgBrownAst;
      const img = imgs[a.sprite % imgs.length];
      return <SkSprite key={a.id} img={img} cx={a.x} cy={a.y} w={sz} h={sz} angle={a.rotation} />;
    })}

    {/* Boss asteroids */}
    {s.asteroids.filter((a) => a.isBoss && a.radius > 0).map((a) => {
      const sz = a.radius * 2;
      const curSprite = a.sprite % imgBoss.length;
      const img = imgBoss[curSprite];
      const flashActive = a.bossFlash && ts - a.bossFlash < 120;
      const dmgProgress = (a.bossDmg ?? 0) / (a.bossDmgMax ?? 1);
      const nextSprite = curSprite + 1;
      const nextImg = nextSprite < imgBoss.length ? imgBoss[nextSprite] : null;
      return (
        <React.Fragment key={a.id}>
          <SkSprite img={img} cx={a.x} cy={a.y} w={sz} h={sz} angle={a.rotation} />
          {nextImg && dmgProgress > 0 && (
            <SkSprite img={nextImg} cx={a.x} cy={a.y} w={sz} h={sz} angle={a.rotation} opacity={dmgProgress} />
          )}
          {a.bossDmgMax !== undefined && (
            <>
              <RoundedRect x={a.x - 25} y={a.y - a.radius - 12} width={50} height={6} r={3} color="rgba(0,0,0,0.5)" />
              <RoundedRect x={a.x - 25} y={a.y - a.radius - 12} width={50 * (1 - dmgProgress)} height={6} r={3} color="#ff6b6b" />
            </>
          )}
        </React.Fragment>
      );
    })}
  </>
));
