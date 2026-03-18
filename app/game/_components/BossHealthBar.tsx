import React from "react";
import { RoundedRect } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import { GW, GH } from "../_shared/constants";
import { max, min } from "../_shared/helpers";

interface BossHealthBarProps {
  s: GameState;
}

export const BossHealthBar = React.memo(({ s }: BossHealthBarProps) => {
  const bossA = s.asteroids.find(a => a.isBoss);
  const alienB = s.alienBoss && s.alienBoss.hp > 0 ? s.alienBoss : null;
  if (!bossA && !alienB) return null;

  let ratio = 0;
  if (alienB) {
    ratio = alienB.hp / alienB.maxHP;
  } else if (bossA) {
    const phases = 3;
    const maxPerPhase = bossA.bossDmgMax ?? 25;
    const remaining = (phases - 1 - bossA.sprite) * maxPerPhase + (maxPerPhase - (bossA.bossDmg ?? 0));
    ratio = remaining / (phases * maxPerPhase);
  }
  ratio = max(0, min(1, ratio));
  const barW = GW - 40;
  const barH = 6;
  const barY = GH - 16;
  const barX = 20;

  return (
    <>
      <RoundedRect x={barX} y={barY} width={barW} height={barH} r={3} color="rgba(0,0,0,0.5)" />
      <RoundedRect x={barX} y={barY} width={barW * ratio} height={barH} r={3} color="#ff6b6b" />
    </>
  );
});
