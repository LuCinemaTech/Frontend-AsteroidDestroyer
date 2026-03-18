import React from "react";
import {
  Circle,
  Line,
  RoundedRect,
  vec,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";
import type { GameState } from "../_shared/types";
import {
  GW, GH, PLANET_R,
  ALIEN_BEAM_WIDTH, ALIEN_FLASH_DURATION,
  DISC_RADIUS,
  BOSS_ALIEN_RADIUS, BOSS_LASER_WARN_DUR, BOSS_LASER_FIRE_DUR,
  BOSS_MEGA_CHARGE_DUR, BOSS_MEGA_FIRE_DUR, BOSS_MEGA_BEAM_WIDTH,
  BOSS_EYE_OFFSETS, BOSS_EYE_SPREADS,
} from "../_shared/constants";
import { cos, sin, PI, max, min, beamPlanetDist, isInBumperArc, beamBumperClip } from "../_shared/helpers";
import { SkSprite } from "./SkSprite";

interface BossAlienRendererProps {
  s: GameState;
  ts: number;
  px: number;
  py: number;
  pa: number;
  imgBossAlien: SkImage | null;
  imgBossAlienAwake: SkImage | null;
  imgBossAlienRed: SkImage | null;
  imgBossAlienRedAwake: SkImage | null;
  imgAlienDisc: SkImage | null;
}

export const BossAlienRenderer = React.memo(({ s, ts, px, py, pa, imgBossAlien, imgBossAlienAwake, imgBossAlienRed, imgBossAlienRedAwake, imgAlienDisc }: BossAlienRendererProps) => {
  if (!s.alienBoss || s.alienBoss.hp <= 0) return null;

  const boss = s.alienBoss;
  const hitFlash = boss.flash > 0 && ts - boss.flash < 120;
  const isCharging = boss.state === 'mega_charge';
  const isMegaFiring = boss.state === 'mega_fire';
  const isLaserWarn = boss.state === 'laser_warn';
  const isLaserFire = boss.state === 'laser_fire';
  const isAttacking = isCharging || isMegaFiring || isLaserWarn || isLaserFire;

  const bossImg = (isCharging || isMegaFiring)
    ? imgBossAlienRedAwake
    : isAttacking ? imgBossAlienRed : imgBossAlien;
  const bossW = BOSS_ALIEN_RADIUS * 2;
  const bossH = BOSS_ALIEN_RADIUS * 3;

  let laserShowRed = false;
  if (isLaserWarn) {
    const elapsed = ts - boss.stateStart;
    const flashCycle = ALIEN_FLASH_DURATION * 2;
    const phase = elapsed % flashCycle;
    laserShowRed = phase < ALIEN_FLASH_DURATION;
  }

  const chargeProgress = isCharging ? min(1, (ts - boss.stateStart) / BOSS_MEGA_CHARGE_DUR) : 0;
  const implosionR = isCharging ? max(5, 150 * (1 - chargeProgress)) : 0;
  const implosionOpacity = isCharging ? 0.3 + chargeProgress * 0.5 : 0;

  return (
    <>
      <React.Fragment key={boss.id}>
        {/* Charge implosion rings */}
        {isCharging && (
          <>
            <Circle cx={boss.x} cy={boss.y} r={implosionR}
              color={`rgba(255,50,30,${(implosionOpacity * 0.3).toFixed(3)})`} />
            <Circle cx={boss.x} cy={boss.y} r={implosionR}
              color={`rgba(255,80,60,${(implosionOpacity * 0.6).toFixed(3)})`}
              style="stroke" strokeWidth={3} />
            <Circle cx={boss.x} cy={boss.y} r={implosionR * 0.6}
              color={`rgba(255,120,80,${(implosionOpacity * 0.4).toFixed(3)})`}
              style="stroke" strokeWidth={2} />
            <Circle cx={boss.x} cy={boss.y} r={10 + chargeProgress * 20}
              color={`rgba(255,80,30,${(chargeProgress * 0.5).toFixed(3)})`} />
          </>
        )}

        {/* Mega beam */}
        {isMegaFiring && (() => {
          const megaLen = max(GW, GH) * 2;
          const sweepPct = min(1, (ts - boss.stateStart) / BOSS_MEGA_FIRE_DUR);

          const clipAtPlanet = (ox: number, oy: number, a: number) => {
            const dx = cos(a), dy = sin(a);
            const fx = ox - s.planetX, fy = oy - s.planetY;
            const hb = fx * dx + fy * dy;
            const c = fx * fx + fy * fy - PLANET_R * PLANET_R;
            const disc = hb * hb - c;
            if (disc < 0) return megaLen;
            const t0 = -hb - Math.sqrt(disc);
            return t0 > 0 ? min(t0, megaLen) : megaLen;
          };

          const megaClip = clipAtPlanet(boss.x, boss.y, boss.targetAngle);
          const bumperOn = s.bumperActive && isInBumperArc(boss.x, boss.y, px, py, pa);
          const megaHit = bumperOn ? beamBumperClip(boss.x, boss.y, boss.targetAngle, px, py) : null;

          return (
            <>
              {megaHit ? (
                <>
                  <Line p1={vec(boss.x, boss.y)} p2={vec(megaHit.hitX, megaHit.hitY)}
                    color="rgba(255,50,30,0.9)" strokeWidth={BOSS_MEGA_BEAM_WIDTH} style="stroke" />
                  <Line p1={vec(boss.x, boss.y)} p2={vec(megaHit.hitX, megaHit.hitY)}
                    color="rgba(255,100,60,0.4)" strokeWidth={BOSS_MEGA_BEAM_WIDTH + 12} style="stroke" />
                  <Line p1={vec(megaHit.hitX, megaHit.hitY)}
                    p2={vec(megaHit.hitX + cos(megaHit.normalAngle + PI / 2) * megaLen,
                            megaHit.hitY + sin(megaHit.normalAngle + PI / 2) * megaLen)}
                    color="rgba(255,80,40,0.6)" strokeWidth={BOSS_MEGA_BEAM_WIDTH * 0.5} style="stroke" />
                  <Line p1={vec(megaHit.hitX, megaHit.hitY)}
                    p2={vec(megaHit.hitX + cos(megaHit.normalAngle - PI / 2) * megaLen,
                            megaHit.hitY + sin(megaHit.normalAngle - PI / 2) * megaLen)}
                    color="rgba(255,80,40,0.6)" strokeWidth={BOSS_MEGA_BEAM_WIDTH * 0.5} style="stroke" />
                  <Circle cx={megaHit.hitX} cy={megaHit.hitY} r={10}
                    color="rgba(255,100,60,0.8)" />
                </>
              ) : (
                <>
                  <Line p1={vec(boss.x, boss.y)}
                    p2={vec(boss.x + cos(boss.targetAngle) * megaClip,
                            boss.y + sin(boss.targetAngle) * megaClip)}
                    color="rgba(255,50,30,0.9)" strokeWidth={BOSS_MEGA_BEAM_WIDTH} style="stroke" />
                  <Line p1={vec(boss.x, boss.y)}
                    p2={vec(boss.x + cos(boss.targetAngle) * megaClip,
                            boss.y + sin(boss.targetAngle) * megaClip)}
                    color="rgba(255,100,60,0.4)" strokeWidth={BOSS_MEGA_BEAM_WIDTH + 12} style="stroke" />
                  <Line p1={vec(boss.x, boss.y)}
                    p2={vec(boss.x + cos(boss.targetAngle) * megaClip,
                            boss.y + sin(boss.targetAngle) * megaClip)}
                    color="rgba(255,150,100,0.15)" strokeWidth={BOSS_MEGA_BEAM_WIDTH + 30} style="stroke" />
                </>
              )}
              {/* Eye lasers during mega */}
              {BOSS_EYE_OFFSETS.map((eo, i) => {
                const ex = boss.x + eo[0];
                const ey = boss.y + eo[1];
                const angle = PI / 2 + BOSS_EYE_SPREADS[i] * (1 - sweepPct);
                const eyeClip = clipAtPlanet(ex, ey, angle);
                if (bumperOn) {
                  const eyeHit = beamBumperClip(ex, ey, angle, px, py);
                  if (eyeHit) return (
                    <React.Fragment key={i}>
                      <Line p1={vec(ex, ey)} p2={vec(eyeHit.hitX, eyeHit.hitY)}
                        color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                      <Line p1={vec(eyeHit.hitX, eyeHit.hitY)}
                        p2={vec(eyeHit.hitX + cos(eyeHit.normalAngle + PI / 2) * megaLen,
                                eyeHit.hitY + sin(eyeHit.normalAngle + PI / 2) * megaLen)}
                        color="rgba(255,80,40,0.5)" strokeWidth={ALIEN_BEAM_WIDTH * 0.7} style="stroke" />
                      <Line p1={vec(eyeHit.hitX, eyeHit.hitY)}
                        p2={vec(eyeHit.hitX + cos(eyeHit.normalAngle - PI / 2) * megaLen,
                                eyeHit.hitY + sin(eyeHit.normalAngle - PI / 2) * megaLen)}
                        color="rgba(255,80,40,0.5)" strokeWidth={ALIEN_BEAM_WIDTH * 0.7} style="stroke" />
                    </React.Fragment>
                  );
                }
                return (
                  <Line key={i} p1={vec(ex, ey)}
                    p2={vec(ex + cos(angle) * eyeClip, ey + sin(angle) * eyeClip)}
                    color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                );
              })}
            </>
          );
        })()}

        {/* Normal laser beam — deflected by bumper */}
        {isLaserFire && (() => {
          const fullLen = max(GW, GH) * 2;
          const clipD = beamPlanetDist(boss.x, boss.y, boss.targetAngle, s.planetX, s.planetY);
          const len = clipD > 0 ? min(clipD, fullLen) : fullLen;
          if (s.bumperActive && isInBumperArc(boss.x, boss.y, px, py, pa)) {
            const clip = beamBumperClip(boss.x, boss.y, boss.targetAngle, px, py);
            if (clip) return (
              <>
                <Line p1={vec(boss.x, boss.y)} p2={vec(clip.hitX, clip.hitY)}
                  color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                <Line p1={vec(clip.hitX, clip.hitY)}
                  p2={vec(clip.hitX + cos(clip.refAngle) * fullLen, clip.hitY + sin(clip.refAngle) * fullLen)}
                  color="rgba(255,50,30,0.7)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
              </>
            );
          }
          return (
            <Line p1={vec(boss.x, boss.y)}
              p2={vec(boss.x + cos(boss.targetAngle) * len, boss.y + sin(boss.targetAngle) * len)}
              color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
          );
        })()}

        {/* Laser warning */}
        {isLaserWarn && laserShowRed && (() => {
          const fullLen = max(GW, GH) * 2;
          const clipD = beamPlanetDist(boss.x, boss.y, boss.targetAngle, s.planetX, s.planetY);
          const len = clipD > 0 ? min(clipD, fullLen) : fullLen;
          if (s.bumperActive && isInBumperArc(boss.x, boss.y, px, py, pa)) {
            const clip = beamBumperClip(boss.x, boss.y, boss.targetAngle, px, py);
            if (clip) return (
              <>
                <Line p1={vec(boss.x, boss.y)} p2={vec(clip.hitX, clip.hitY)}
                  color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
                <Line p1={vec(clip.hitX, clip.hitY)}
                  p2={vec(clip.hitX + cos(clip.refAngle) * fullLen, clip.hitY + sin(clip.refAngle) * fullLen)}
                  color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
              </>
            );
          }
          return (
            <Line p1={vec(boss.x, boss.y)}
              p2={vec(boss.x + cos(boss.targetAngle) * len, boss.y + sin(boss.targetAngle) * len)}
              color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
          );
        })()}

        {/* Boss sprite */}
        <SkSprite img={bossImg} cx={boss.x} cy={boss.y} w={bossW} h={bossH}
          angle={0} opacity={hitFlash ? 0.5 : 1} />

        {/* Health bar */}
        <RoundedRect x={boss.x - 35} y={boss.y - bossH / 2 - 12} width={70} height={6}
          r={3} color="rgba(0,0,0,0.5)" />
        <RoundedRect x={boss.x - 35} y={boss.y - bossH / 2 - 12}
          width={70 * (boss.hp / boss.maxHP)} height={6} r={3} color="#ff6b6b" />
      </React.Fragment>

      {/* Boss Discs (homing pairs) */}
      {s.bossDiscs.map((d) => {
        const discHitFlash = d.flash > 0 && ts - d.flash < 120;
        const outerSz = DISC_RADIUS * 2;
        const innerSz = DISC_RADIUS * 1.2;
        return (
          <React.Fragment key={d.id}>
            <SkSprite img={imgAlienDisc} cx={d.x} cy={d.y} w={outerSz} h={outerSz}
              angle={d.outerAngle} opacity={discHitFlash ? 0.5 : 1} />
            <SkSprite img={imgAlienDisc} cx={d.x} cy={d.y} w={innerSz} h={innerSz}
              angle={d.innerAngle} opacity={discHitFlash ? 0.4 : 0.85} />
          </React.Fragment>
        );
      })}
    </>
  );
});
