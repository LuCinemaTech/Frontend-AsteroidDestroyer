import React from "react";
import { Image } from "react-native";
import type { GameState, PowerType } from "../_shared/types";
import {
  CX, CY, GW, GH, ORBIT_R, PLAYER_H,
  POWER_R, SHIELD_MAX_HP, POWER_ICONS,
} from "../_shared/constants";
import { gameConfig } from "../_shared/gameConfig";
import { hypot, cos, sin, max } from "../_shared/helpers";

// ── Power-up logic (homing, collection, effects) ───────────────────

export function updatePowerUps(s: GameState, ts: number): void {
  const pxh = s.planetX + ORBIT_R * cos(s.playerAngle);
  const pyh = s.planetY + ORBIT_R * sin(s.playerAngle);
  const HOME_SPEED = 2.5;

  // Homing movement
  for (const p of s.powerUps) {
    const dx = pxh - p.x;
    const dy = pyh - p.y;
    const dist = hypot(dx, dy) || 1;
    p.vx += (dx / dist) * 0.15;
    p.vy += (dy / dist) * 0.15;
    const spd = hypot(p.vx, p.vy);
    if (spd > HOME_SPEED) {
      p.vx = (p.vx / spd) * HOME_SPEED;
      p.vy = (p.vy / spd) * HOME_SPEED;
    }
    p.x += p.vx;
    p.y += p.vy;
  }

  // Collection
  s.powerUps = s.powerUps.filter((pu) => {
    if (hypot(pu.x - pxh, pu.y - pyh) < POWER_R + PLAYER_H * 0.5) {
      switch (pu.type) {
        case "wave":
          s.waveAmmo = Math.min(gameConfig.powerUpEffects.waveAmmoMax, s.waveAmmo + gameConfig.powerUpEffects.waveAmmoGrant);
          break;
        case "shield":
          if (!(s.shieldActive > 0 && s.shieldHP > 0)) {
            s.shieldActive = ts + gameConfig.powerUpEffects.shieldDuration;
            s.shieldHP = SHIELD_MAX_HP;
          } else {
            const unshielded = s.satellites.find((sat) => !sat.shieldActive);
            if (unshielded) unshielded.shieldActive = true;
          }
          break;
        case "missile":
          s.missileCount = Math.min(gameConfig.powerUpEffects.missileMax, s.missileCount + gameConfig.powerUpEffects.missileGrant);
          break;
        case "immortality":
          if (!s.immortalPhase) {
            s.immortal = true;
            s.immortalExpire = 0; // managed by phase timer now
            s.immortalPhase = 'departing';
            s.immortalStart = ts;
            const sx = s.planetX + ORBIT_R * cos(s.playerAngle);
            const sy = s.planetY + ORBIT_R * sin(s.playerAngle);
            s.immortalShipX = sx;
            s.immortalShipY = sy;
            s.immortalDepartX = sx;
            s.immortalDepartY = sy;
            s.immortalDepartRot = s.playerAngle + Math.PI / 2;
            // Save current wave state so we can restore after
            s.immortalSavedWave = s.wave;
            s.immortalSavedAsteroids = [...s.asteroids];
            s.immortalSavedPlanetY = s.planetY;
            // Give permanent shield
            s.shieldActive = ts + 999999;
            s.shieldHP = SHIELD_MAX_HP;
          }
          break;
        case "heal":
          if (s.planetStage > 0) s.planetStage = max(0, s.planetStage - 1);
          break;
      }
      return false;
    }
    if (hypot(pu.x - CX, pu.y - CY) > max(GW, GH) * 0.7) return false;
    return true;
  });
}

// ── Power-up render ────────────────────────────────────────────────

interface PowerUpsProps {
  powerUps: { id: number; x: number; y: number; type: PowerType }[];
}

export default function PowerUps({ powerUps }: PowerUpsProps) {
  return (
    <>
      {powerUps.map((p) => (
        <Image
          key={p.id}
          source={POWER_ICONS[p.type]}
          style={{
            position: "absolute",
            left: p.x - POWER_R,
            top: p.y - POWER_R,
            width: POWER_R * 2,
            height: POWER_R * 2,
          }}
          resizeMode="contain"
        />
      ))}
    </>
  );
}
