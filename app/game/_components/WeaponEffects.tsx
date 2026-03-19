import React from "react";
import {
  Image as SkiaImage,
  Circle,
  Line,
  Group,
  Paint,
  ColorMatrix,
  vec,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import {
  GW, GH, ORBIT_R,
  DISC_RADIUS,
  PLASMA_COLORS,
} from "../_shared/constants";
import { cos, sin, atan2, PI, PI2, max, min } from "../_shared/helpers";
import { SkSprite, tintMatrix } from "./SkSprite";

interface WeaponEffectsProps {
  s: GameState;
  ts: number;
  px: number;
  py: number;
  pa: number;
  imgPhotonBlue: SkImage | null;
  imgWaveArc: SkImage | null;
  imgAlienDisc: SkImage | null;
  imgAlienBlue: SkImage | null;
  imgDroneBlue: SkImage | null;
  astImgMap: Record<string, (SkImage | null)[]>;
  imgBrownAst: (SkImage | null)[];
}

export const WeaponEffects = React.memo(({ s, ts, px, py, pa, imgPhotonBlue, imgWaveArc, imgAlienDisc, imgAlienBlue, imgDroneBlue, astImgMap, imgBrownAst }: WeaponEffectsProps) => (
  <>
    {/* Bullets (laser) */}
    {s.bullets.map((b) => {
      const bAngle = atan2(b.vy, b.vx) + PI / 2;
      return <SkSprite key={b.id} img={imgPhotonBlue} cx={b.x} cy={b.y} w={26} h={54} angle={bAngle} tint={PLASMA_COLORS[s.laserColor]?.rgb} />;
    })}

    {/* Waves — arcs with aura */}
    {s.waves.map((w) => {
      const opacity = max(0.15, 1 - w.radius / 500);
      const pc = PLASMA_COLORS[s.laserColor];
      const r = pc.rgb[0]; const g = pc.rgb[1]; const b = pc.rgb[2];
      const tileSize = 20 + w.radius * 0.06;
      const arcLen = w.arcWidth * w.radius;
      const numTiles = max(3, Math.ceil(arcLen / (tileSize * 0.5)));
      const startAngle = w.angle - w.arcWidth / 2;
      const stepA = w.arcWidth / (numTiles - 1 || 1);
      const auraR = tileSize * 0.6;
      const elements: React.ReactNode[] = [];

      for (let i = 0; i < numTiles; i++) {
        const a = startAngle + stepA * i;
        const ax = w.x + cos(a) * w.radius;
        const ay = w.y + sin(a) * w.radius;
        elements.push(
          <Circle key={`a-${w.id}-${i}`} cx={ax} cy={ay} r={auraR} color={`rgba(${r},${g},${b},${(opacity * 0.045).toFixed(3)})`} />
        );
        if (imgWaveArc) {
          const tangentRad = a + PI / 2;
          elements.push(
            <Group key={`t-${w.id}-${i}`} transform={[{ translateX: ax }, { translateY: ay }, { rotate: tangentRad }, { translateX: -tileSize / 2 }, { translateY: -tileSize / 2 }]} opacity={opacity}>
              <SkiaImage image={imgWaveArc} x={0} y={0} width={tileSize} height={tileSize} fit="contain">
                <Paint><ColorMatrix matrix={tintMatrix(r, g, b, 1)} /></Paint>
              </SkiaImage>
            </Group>
          );
        }
      }
      return <React.Fragment key={w.id}>{elements}</React.Fragment>;
    })}

    {/* Plasma Nuke pulses */}
    {s.plasmaPulses.map((p) => {
      const pctDone = p.radius / p.maxRadius;
      const opacity = max(0.1, 1 - pctDone);
      const tileSize = 20 + p.radius * 0.04;
      const circumference = PI2 * p.radius;
      const numTiles = max(12, Math.ceil(circumference / (tileSize * 0.35)));
      const stepA = PI2 / numTiles;
      const elements: React.ReactNode[] = [];

      for (let i = 0; i < numTiles; i++) {
        const a = stepA * i;
        const tx = p.x + cos(a) * p.radius;
        const ty = p.y + sin(a) * p.radius;
        const auraR = tileSize * 0.6;
        elements.push(
          <Circle key={`pa-${p.id}-${i}`} cx={tx} cy={ty} r={auraR} color={`rgba(200,80,240,${(opacity * 0.05).toFixed(3)})`} />
        );
        if (imgWaveArc) {
          const tangentRad = a + PI / 2;
          elements.push(
            <Group key={`pt-${p.id}-${i}`} transform={[{ translateX: tx }, { translateY: ty }, { rotate: tangentRad }, { translateX: -tileSize / 2 }, { translateY: -tileSize / 2 }]} opacity={opacity}>
              <SkiaImage image={imgWaveArc} x={0} y={0} width={tileSize} height={tileSize} fit="contain">
                <Paint><ColorMatrix matrix={tintMatrix(200, 80, 240, 1)} /></Paint>
              </SkiaImage>
            </Group>
          );
        }
      }
      return <React.Fragment key={p.id}>{elements}</React.Fragment>;
    })}

    {/* Charged Plasma — reverse wave charge-up visual */}
    {s.plasmaCharging && s.plasmaChargeCount > 0 && (() => {
      const shipX = s.planetX + ORBIT_R * cos(pa);
      const shipY = s.planetY + ORBIT_R * sin(pa);
      const CHARGE_INTERVAL = 600;
      const elapsed = ts - s.plasmaChargeStart;
      const chargePhase = (elapsed % CHARGE_INTERVAL) / CHARGE_INTERVAL;
      const maxDrawR = 120;
      const drawR = maxDrawR * (1 - chargePhase);
      const rings: React.ReactNode[] = [];
      for (let c = 0; c < s.plasmaChargeCount; c++) {
        const isLatest = c === s.plasmaChargeCount - 1;
        const ringR = isLatest ? drawR : 0;
        if (ringR < 5) continue;
        const intensity = 0.3 + (s.plasmaChargeCount / 10) * 0.5;
        const numTiles = max(8, Math.ceil(PI2 * ringR / 15));
        const stepA = PI2 / numTiles;
        for (let i = 0; i < numTiles; i++) {
          const a = stepA * i;
          const tx = shipX + cos(a) * ringR;
          const ty = shipY + sin(a) * ringR;
          rings.push(
            <Circle key={`cr-${c}-${i}`} cx={tx} cy={ty} r={4}
              color={`rgba(0,255,200,${intensity.toFixed(2)})`} />
          );
        }
      }
      const glowR = 8 + s.plasmaChargeCount * 3;
      const glowOp = 0.15 + (s.plasmaChargeCount / 10) * 0.35;
      rings.push(
        <Circle key="charge-glow" cx={shipX} cy={shipY} r={glowR}
          color={`rgba(0,255,200,${glowOp.toFixed(2)})`} />
      );
      return <>{rings}</>;
    })()}

    {/* Charged Plasma — straight beam laser */}
    {s.chargedPlasmas.map((cp) => {
      const elapsed = ts - cp.startTime;
      const pct = min(1, elapsed / cp.duration);
      const fadeIn = min(1, elapsed / 80);
      const fadeOut = pct > 0.7 ? 1 - (pct - 0.7) / 0.3 : 1;
      const opacity = fadeIn * fadeOut;
      const ex = cp.x + cos(cp.angle) * cp.length;
      const ey = cp.y + sin(cp.angle) * cp.length;
      const p1 = vec(cp.x, cp.y);
      const p2 = vec(ex, ey);
      return (
        <React.Fragment key={cp.id}>
          <Line p1={p1} p2={p2}
            color={`rgba(0,200,160,${(opacity * 0.12).toFixed(3)})`}
            strokeWidth={cp.width + 28} style="stroke" />
          <Line p1={p1} p2={p2}
            color={`rgba(0,235,190,${(opacity * 0.35).toFixed(3)})`}
            strokeWidth={cp.width + 12} style="stroke" />
          <Line p1={p1} p2={p2}
            color={`rgba(0,255,220,${(opacity * 0.9).toFixed(3)})`}
            strokeWidth={cp.width} style="stroke" />
        </React.Fragment>
      );
    })}

    {/* Cross Lasers */}
    {s.crossLasers.map((cl) => {
      const elapsed = ts - cl.startTime;
      const pct = min(1, elapsed / cl.duration);
      const fadeIn = min(1, elapsed / 100);
      const fadeOut = pct > 0.75 ? 1 - (pct - 0.75) / 0.25 : 1;
      const opacity = fadeIn * fadeOut;
      const sweepPct = min(1, elapsed / cl.duration);
      const beamLen = max(GW, GH) * 2;
      const clx = s.planetX + ORBIT_R * cos(s.playerAngle);
      const cly = s.planetY + ORBIT_R * sin(s.playerAngle);
      const clAngle = s.playerAngle;
      return (
        <React.Fragment key={cl.id}>
          {cl.spreads.map((spread, i) => {
            const angle = clAngle + spread * (1 - sweepPct * 2);
            const ex = clx + cos(angle) * beamLen;
            const ey = cly + sin(angle) * beamLen;
            const p1 = vec(clx, cly);
            const p2 = vec(ex, ey);
            return (
              <React.Fragment key={i}>
                <Line p1={p1} p2={p2}
                  color={`rgba(255,100,50,${(opacity * 0.10).toFixed(3)})`}
                  strokeWidth={22} style="stroke" />
                <Line p1={p1} p2={p2}
                  color={`rgba(255,150,60,${(opacity * 0.30).toFixed(3)})`}
                  strokeWidth={10} style="stroke" />
                <Line p1={p1} p2={p2}
                  color={`rgba(255,220,120,${(opacity * 0.85).toFixed(3)})`}
                  strokeWidth={3} style="stroke" />
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    })}

    {/* Chain Lightning */}
    {s.chainLightnings.map((cl) => {
      const elapsed = ts - cl.startTime;
      const pct = min(1, elapsed / cl.duration);
      const fadeIn = min(1, elapsed / 60);
      const fadeOut = pct > 0.5 ? 1 - (pct - 0.5) / 0.5 : 1;
      const opacity = fadeIn * fadeOut;
      return (
        <React.Fragment key={cl.id}>
          {cl.links.map((link, li) => {
            const pts = [{ x: link.x1, y: link.y1 }, ...link.jags, { x: link.x2, y: link.y2 }];
            return (
              <React.Fragment key={li}>
                {pts.map((p, pi) => {
                  if (pi === 0) return null;
                  const prev = pts[pi - 1];
                  const p1 = vec(prev.x, prev.y);
                  const p2 = vec(p.x, p.y);
                  return (
                    <React.Fragment key={pi}>
                      <Line p1={p1} p2={p2}
                        color={`rgba(100,180,255,${(opacity * 0.15).toFixed(3)})`}
                        strokeWidth={14} style="stroke" />
                      <Line p1={p1} p2={p2}
                        color={`rgba(140,220,255,${(opacity * 0.4).toFixed(3)})`}
                        strokeWidth={6} style="stroke" />
                      <Line p1={p1} p2={p2}
                        color={`rgba(220,240,255,${(opacity * 0.95).toFixed(3)})`}
                        strokeWidth={2} style="stroke" />
                    </React.Fragment>
                  );
                })}
                <Circle cx={link.x2} cy={link.y2} r={8 + 6 * (1 - pct)}
                  color={`rgba(150,220,255,${(opacity * 0.5).toFixed(3)})`} />
              </React.Fragment>
            );
          })}
        </React.Fragment>
      );
    })}

    {/* Player Discs */}
    {s.playerDiscs.map((pd) => {
      const elapsed = ts - pd.startTime;
      const pct = min(1, elapsed / pd.duration);
      const fadeOut = pct > 0.8 ? 1 - (pct - 0.8) / 0.2 : 1;
      const outerSz = DISC_RADIUS * 2;
      const innerSz = DISC_RADIUS * 1.2;
      return (
        <React.Fragment key={pd.id}>
          <Circle cx={pd.x} cy={pd.y} r={DISC_RADIUS + 6}
            color={`rgba(80,255,120,${(0.15 * fadeOut).toFixed(3)})`} />
          <SkSprite img={imgAlienDisc} cx={pd.x} cy={pd.y} w={outerSz} h={outerSz}
            angle={pd.outerAngle} opacity={fadeOut} />
          <SkSprite img={imgAlienDisc} cx={pd.x} cy={pd.y} w={innerSz} h={innerSz}
            angle={pd.innerAngle} opacity={fadeOut * 0.85} />
          <Circle cx={pd.x} cy={pd.y} r={DISC_RADIUS}
            color={`rgba(0,255,100,${(0.12 * fadeOut).toFixed(3)})`} />
        </React.Fragment>
      );
    })}

    {/* Magnet field visual */}
    {s.magnetActive && !s.shipDestroyed && (() => {
      const MAGNET_RANGE = 250;
      const COLLECT_DIST = 50;
      const collectX = px + cos(pa) * COLLECT_DIST;
      const collectY = py + sin(pa) * COLLECT_DIST;
      const pulse = Math.sin(ts * 0.008) * 0.15 + 0.85;
      const heldProjectiles = s.magnetProjectiles.filter(mp => mp.held);
      return (
        <>
          <Circle cx={px} cy={py} r={MAGNET_RANGE * pulse}
            color={`rgba(255,50,50,${(0.06).toFixed(3)})`} />
          <Circle cx={px} cy={py} r={MAGNET_RANGE * pulse}
            color="rgba(255,80,80,0.25)" style="stroke" strokeWidth={2} />
          <Circle cx={collectX} cy={collectY} r={20 + Math.sin(ts * 0.01) * 5}
            color="rgba(255,60,60,0.2)" />
          <Circle cx={collectX} cy={collectY} r={10}
            color="rgba(255,100,100,0.5)" />
          {heldProjectiles.map(mp => (
            <Line key={`mag-${mp.id}`}
              p1={vec(collectX, collectY)} p2={vec(mp.x, mp.y)}
              color="rgba(255,80,80,0.3)" strokeWidth={2} style="stroke" />
          ))}
          {heldProjectiles.length > 0 && (
            <Circle cx={collectX} cy={collectY} r={14 + heldProjectiles.length * 2}
              color="rgba(255,50,50,0.12)" />
          )}
        </>
      );
    })()}

    {/* Magnet Projectiles (held + flung) */}
    {s.magnetProjectiles.map((mp) => {
      const elapsed = ts - mp.startTime;
      const pct = mp.held ? 0 : min(1, elapsed / mp.duration);
      const fadeOut = mp.held ? 1 : (pct > 0.7 ? 1 - (pct - 0.7) / 0.3 : 1);
      const sz = mp.radius * 2;
      const eImg = mp.enemyType === 'fighter' ? imgAlienBlue
        : mp.enemyType === 'drone' ? imgDroneBlue
        : null;
      return (
        <React.Fragment key={mp.id}>
          <Circle cx={mp.x} cy={mp.y} r={mp.radius + 8}
            color={`rgba(255,50,50,${(0.2 * fadeOut).toFixed(3)})`} />
          {eImg ? (
            <SkSprite img={eImg} cx={mp.x} cy={mp.y} w={sz} h={sz}
              angle={mp.rotation} opacity={fadeOut} />
          ) : (
            <SkSprite img={(astImgMap[mp.asteroidType] ?? astImgMap.brown)[mp.sprite % (astImgMap[mp.asteroidType] ?? astImgMap.brown).length]}
              cx={mp.x} cy={mp.y} w={sz} h={sz}
              angle={mp.rotation} opacity={fadeOut} />
          )}
        </React.Fragment>
      );
    })}
  </>
));
