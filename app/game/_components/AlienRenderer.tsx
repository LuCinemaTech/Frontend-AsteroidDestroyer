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
  ALIEN_RADIUS, ALIEN_FLASH_DURATION, ALIEN_BEAM_WIDTH,
  DISC_RADIUS, DRONE_RADIUS,
  GW, GH,
} from "../_shared/constants";
import { cos, sin, PI, max, min, beamPlanetDist, isInBumperArc, beamBumperClip } from "../_shared/helpers";
import { SkSprite } from "./SkSprite";

interface AlienRendererProps {
  s: GameState;
  ts: number;
  px: number;
  py: number;
  pa: number;
  imgAlienBlue: SkImage | null;
  imgAlienRed: SkImage | null;
  imgAlienDisc: SkImage | null;
  imgDroneBlue: SkImage | null;
  imgDroneRed: SkImage | null;
}

export const AlienRenderer = React.memo(({ s, ts, px, py, pa, imgAlienBlue, imgAlienRed, imgAlienDisc, imgDroneBlue, imgDroneRed }: AlienRendererProps) => (
  <>
    {/* Alien Fighters */}
    {s.alienFighters.map((af) => {
      const isWarning = af.state === 'warning';
      const isFiring = af.state === 'firing';
      const isBombing = af.state === 'bombing';
      const hitFlash = af.flash > 0 && ts - af.flash < 120;

      let showRed = false;
      if (isWarning) {
        const elapsed = ts - af.flashStart;
        const flashCycle = ALIEN_FLASH_DURATION * 2;
        const phase = elapsed % flashCycle;
        showRed = phase < ALIEN_FLASH_DURATION;
      }

      const alienImg = (isFiring || isBombing || showRed) ? imgAlienRed : imgAlienBlue;
      const sz = ALIEN_RADIUS * 2;
      const faceAngle = isBombing ? 0 : af.faceAngle - PI / 2;

      return (
        <React.Fragment key={af.id}>
          {isFiring && (() => {
            const fullLen = max(GW, GH) * 2;
            const clipD = beamPlanetDist(af.x, af.y, af.targetAngle, s.planetX, s.planetY);
            const len = clipD > 0 ? min(clipD, fullLen) : fullLen;
            if (s.bumperActive && isInBumperArc(af.x, af.y, px, py, pa)) {
              const clip = beamBumperClip(af.x, af.y, af.targetAngle, px, py);
              if (clip) return (
                <>
                  <Line p1={vec(af.x, af.y)} p2={vec(clip.hitX, clip.hitY)}
                    color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                  <Line p1={vec(clip.hitX, clip.hitY)}
                    p2={vec(clip.hitX + cos(clip.refAngle) * fullLen, clip.hitY + sin(clip.refAngle) * fullLen)}
                    color="rgba(255,50,30,0.7)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                </>
              );
            }
            return (
              <Line p1={vec(af.x, af.y)}
                p2={vec(af.x + cos(af.targetAngle) * len, af.y + sin(af.targetAngle) * len)}
                color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
            );
          })()}
          {isWarning && showRed && (() => {
            const fullLen = max(GW, GH) * 2;
            const clipD = beamPlanetDist(af.x, af.y, af.targetAngle, s.planetX, s.planetY);
            const len = clipD > 0 ? min(clipD, fullLen) : fullLen;
            if (s.bumperActive && isInBumperArc(af.x, af.y, px, py, pa)) {
              const clip = beamBumperClip(af.x, af.y, af.targetAngle, px, py);
              if (clip) return (
                <>
                  <Line p1={vec(af.x, af.y)} p2={vec(clip.hitX, clip.hitY)}
                    color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
                  <Line p1={vec(clip.hitX, clip.hitY)}
                    p2={vec(clip.hitX + cos(clip.refAngle) * fullLen, clip.hitY + sin(clip.refAngle) * fullLen)}
                    color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
                </>
              );
            }
            return (
              <Line p1={vec(af.x, af.y)}
                p2={vec(af.x + cos(af.targetAngle) * len, af.y + sin(af.targetAngle) * len)}
                color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
            );
          })()}
          <SkSprite img={alienImg} cx={af.x} cy={af.y} w={sz} h={sz * 1.5} angle={faceAngle} opacity={hitFlash ? 0.5 : 1} />
          {af.hp < af.maxHP && (
            <>
              <RoundedRect x={af.x - 16} y={af.y - ALIEN_RADIUS - 10} width={32} height={4} r={2} color="rgba(0,0,0,0.5)" />
              <RoundedRect x={af.x - 16} y={af.y - ALIEN_RADIUS - 10} width={32 * (af.hp / af.maxHP)} height={4} r={2} color="#4cd137" />
            </>
          )}
        </React.Fragment>
      );
    })}

    {/* Alien Discs (dual-spin) */}
    {s.alienDiscs.map((d) => {
      const GROW_DUR = 400;
      const growScale = d.growEnd ? Math.max(0.05, 1 - (d.growEnd - ts) / GROW_DUR) : 1;
      const hitFlash = d.flash > 0 && ts - d.flash < 120;
      const outerSz = DISC_RADIUS * 2 * growScale;
      const innerSz = DISC_RADIUS * 1.2 * growScale;
      return (
        <React.Fragment key={d.id}>
          <SkSprite img={imgAlienDisc} cx={d.x} cy={d.y} w={outerSz} h={outerSz} angle={d.outerAngle} opacity={hitFlash ? 0.5 : 1} />
          <SkSprite img={imgAlienDisc} cx={d.x} cy={d.y} w={innerSz} h={innerSz} angle={d.innerAngle} opacity={hitFlash ? 0.4 : 0.85} />
        </React.Fragment>
      );
    })}

    {/* Disc Shockwaves (red plasma) */}
    {s.discShockwaves.map((sw) => {
      const pct = sw.radius / sw.maxRadius;
      const opacity = Math.max(0, 1 - pct);
      return (
        <React.Fragment key={sw.id}>
          <Circle cx={sw.x} cy={sw.y} r={sw.radius} color={`rgba(255,50,30,${(opacity * 0.25).toFixed(3)})`} />
          <Circle cx={sw.x} cy={sw.y} r={sw.radius} color={`rgba(255,80,60,${(opacity * 0.6).toFixed(3)})`} style="stroke" strokeWidth={3} />
          <Circle cx={sw.x} cy={sw.y} r={sw.radius * 0.7} color={`rgba(255,120,80,${(opacity * 0.3).toFixed(3)})`} style="stroke" strokeWidth={2} />
        </React.Fragment>
      );
    })}

    {/* Alien Drones (wave 3 turrets) */}
    {s.alienDrones.map((d) => {
      const isWarning = d.state === 'warning';
      const isFiring = d.state === 'firing';
      const hitFlash = d.flash > 0 && ts - d.flash < 120;

      let showRed = false;
      if (isWarning) {
        const elapsed = ts - d.flashStart;
        const flashCycle = ALIEN_FLASH_DURATION * 2;
        const phase = elapsed % flashCycle;
        showRed = phase < ALIEN_FLASH_DURATION;
      }

      const droneImg = (isFiring || showRed) ? imgDroneRed : imgDroneBlue;
      const sz = DRONE_RADIUS * 2;

      return (
        <React.Fragment key={d.id}>
          {isFiring && (() => {
            const fullLen = max(GW, GH) * 2;
            const clipD = beamPlanetDist(d.x, d.y, d.targetAngle, s.planetX, s.planetY);
            const len = clipD > 0 ? min(clipD, fullLen) : fullLen;
            if (s.bumperActive && isInBumperArc(d.x, d.y, px, py, pa)) {
              const clip = beamBumperClip(d.x, d.y, d.targetAngle, px, py);
              if (clip) return (
                <>
                  <Line p1={vec(d.x, d.y)} p2={vec(clip.hitX, clip.hitY)}
                    color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                  <Line p1={vec(clip.hitX, clip.hitY)}
                    p2={vec(clip.hitX + cos(clip.refAngle) * fullLen, clip.hitY + sin(clip.refAngle) * fullLen)}
                    color="rgba(255,50,30,0.7)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
                </>
              );
            }
            return (
              <Line p1={vec(d.x, d.y)}
                p2={vec(d.x + cos(d.targetAngle) * len, d.y + sin(d.targetAngle) * len)}
                color="rgba(255,50,30,0.8)" strokeWidth={ALIEN_BEAM_WIDTH} style="stroke" />
            );
          })()}
          {isWarning && showRed && (() => {
            const fullLen = max(GW, GH) * 2;
            const clipD = beamPlanetDist(d.x, d.y, d.targetAngle, s.planetX, s.planetY);
            const len = clipD > 0 ? min(clipD, fullLen) : fullLen;
            if (s.bumperActive && isInBumperArc(d.x, d.y, px, py, pa)) {
              const clip = beamBumperClip(d.x, d.y, d.targetAngle, px, py);
              if (clip) return (
                <>
                  <Line p1={vec(d.x, d.y)} p2={vec(clip.hitX, clip.hitY)}
                    color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
                  <Line p1={vec(clip.hitX, clip.hitY)}
                    p2={vec(clip.hitX + cos(clip.refAngle) * fullLen, clip.hitY + sin(clip.refAngle) * fullLen)}
                    color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
                </>
              );
            }
            return (
              <Line p1={vec(d.x, d.y)}
                p2={vec(d.x + cos(d.targetAngle) * len, d.y + sin(d.targetAngle) * len)}
                color="rgba(255,50,30,0.15)" strokeWidth={1} style="stroke" />
            );
          })()}
          <SkSprite img={droneImg} cx={d.x} cy={d.y} w={sz} h={sz}
            angle={d.rotation} opacity={hitFlash ? 0.5 : 1} />
          {d.hp < d.maxHP && (
            <>
              <RoundedRect x={d.x - 12} y={d.y - DRONE_RADIUS - 8} width={24} height={3}
                r={1} color="rgba(0,0,0,0.5)" />
              <RoundedRect x={d.x - 12} y={d.y - DRONE_RADIUS - 8}
                width={24 * (d.hp / d.maxHP)} height={3} r={1} color="#4cd137" />
            </>
          )}
        </React.Fragment>
      );
    })}
  </>
));
