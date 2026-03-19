import React from "react";
import { View, Image } from "react-native";
import type { GameState } from "../_shared/types";
import {
  ORBIT_R, PLAYER_W, PLAYER_H,
  SHIELD_R, EXPLOSION_COLORS,
  SHIP_IMAGES, SHIP_GOLD_IMAGE,
  BUMPER_R, CX, CY,
} from "../_shared/constants";
import { gameConfig } from "../_shared/gameConfig";
import {
  uid, hypot, cos, sin, rand, PI, PI2,
  floor, round, max, min,
  bossDamage, spawnAsteroidDebris, spawnBossDebris, mkPowerUpAt,
  spawnMetalDebris, getAsteroidPoints, addScorePopup, isInBumperArc,
  damageShip,
} from "../_shared/helpers";

// ── Ship logic (ship↔asteroid, shield↔asteroid) ───────────────────

export function updateShip(s: GameState, ts: number): void {
  const pxp = s.planetX + ORBIT_R * cos(s.playerAngle);
  const pyp = s.planetY + ORBIT_R * sin(s.playerAngle);

  // Bumper ↔ asteroid collision (bounce back)
  if (s.bumperActive && !s.shipDestroyed) {
    for (const a of s.asteroids) {
      const dist = hypot(a.x - pxp, a.y - pyp);
      if (dist < BUMPER_R + a.radius && isInBumperArc(a.x, a.y, pxp, pyp, s.playerAngle)) {
        const nx = (a.x - pxp) / (dist || 1);
        const ny = (a.y - pyp) / (dist || 1);
        const dot = a.vx * nx + a.vy * ny;
        if (dot < 0) {
          const spd = hypot(a.vx, a.vy) * 2 + 3;
          a.vx = nx * spd;
          a.vy = ny * spd;
          for (let i = 0; i < 6; i++) {
            const pa = rand() * PI2;
            s.particles.push({
              id: uid(), x: a.x, y: a.y,
              vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.4, color: "#00ff88",
            });
          }
        }
      }
    }
  }

  // Ship ↔ asteroid collision (no shield, not immortal) — asteroid is destroyed on impact
  if (!s.shipDestroyed && !s.immortal && !(s.shieldActive > 0 && s.shieldHP > 0)) {
    const SHIP_HIT_R = PLAYER_H * 1.2;
    s.asteroids = s.asteroids.filter((a) => {
      if (hypot(a.x - pxp, a.y - pyp) < SHIP_HIT_R + a.radius) {
        // Boss asteroids take damage but don't get removed
        if (a.isBoss && a.bossHP !== undefined) {
          damageShip(s, ts, pxp, pyp, 25);
          return true;
        }
        // Normal asteroid: destroy it and damage ship
        spawnAsteroidDebris(s, a);
        damageShip(s, ts, pxp, pyp, 25);
        return false;
      }
      return true;
    });
  }

  // Shield ↔ asteroid collisions
  if (s.shieldActive > 0 && s.shieldHP > 0) {
    s.asteroids = s.asteroids.filter((a) => {
      if (hypot(a.x - pxp, a.y - pyp) < SHIELD_R + a.radius) {
        s.shieldHP--;
        for (let i = 0; i < 5; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: a.x, y: a.y,
            vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.8, color: "#74b9ff",
          });
        }
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossHP = max(0, a.bossHP - 2);
          a.bossFlash = ts;
          const destroyed = bossDamage(a, 2);
          if (destroyed) { a.sprite = min(2, a.sprite + 1); a.bossDmg = 0; }
          if (a.bossHP <= 0) {
            s.score += round(gameConfig.bossAsteroidPoints * s.multiplier);
            addScorePopup(s, a.x, a.y, round(gameConfig.bossAsteroidPoints * s.multiplier));
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            for (let i = 0; i < 30; i++) {
              const pa2 = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: cos(pa2) * pspd, vy: sin(pa2) * pspd,
                life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnBossDebris(s, a);
            return false;
          }
          return true;
        }
        if (!a.isBoss) {
          s.asteroidsCleared++;
          const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
          s.score += pts;
          addScorePopup(s, a.x, a.y, pts);
          s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
          if (a.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
          spawnAsteroidDebris(s, a);
          return false;
        }
      }
      return true;
    });
  }
}

// ── Ship render (glow, ship image, shield forcefield, planet shield) ──

interface ShipProps {
  playerAngle: number;
  shipDestroyed: boolean;
  immortal: boolean;
  waveAmmo: number;
  selectedWeapon: string;
  shieldActive: number;
  shieldHP: number;
  planetShield: boolean;
  shipColor: string;
}

export default function Ship({
  playerAngle, shipDestroyed, immortal, waveAmmo, selectedWeapon,
  shieldActive, shieldHP, planetShield, shipColor,
}: ShipProps) {
  const pxp = CX + ORBIT_R * cos(playerAngle);
  const pyp = CY + ORBIT_R * sin(playerAngle);
  const now = performance.now();

  return (
    <>
      {/* Wave-active glow */}
      {selectedWeapon === 'wave' && waveAmmo > 0 && !shipDestroyed && (
        <>
          <View style={{
            position: "absolute", left: pxp - 40, top: pyp - 40,
            width: 80, height: 80, borderRadius: 40,
            backgroundColor: "rgba(253,203,110,0.15)",
          }} />
          <View style={{
            position: "absolute", left: pxp - 25, top: pyp - 25,
            width: 50, height: 50, borderRadius: 25,
            backgroundColor: "rgba(253,203,110,0.25)",
          }} />
          <View style={{
            position: "absolute", left: pxp - 14, top: pyp - 14,
            width: 28, height: 28, borderRadius: 14,
            backgroundColor: "rgba(253,203,110,0.4)",
          }} />
        </>
      )}

      {/* Ship image */}
      {!shipDestroyed && (
        <Image
          source={immortal ? SHIP_GOLD_IMAGE : SHIP_IMAGES[shipColor]}
          style={{
            position: "absolute",
            left: pxp - PLAYER_W / 2, top: pyp - PLAYER_H / 2,
            width: PLAYER_W, height: PLAYER_H,
            transform: [{ rotate: `${playerAngle + Math.PI / 2}rad` }],
          }}
          resizeMode="contain"
        />
      )}

      {/* Shield forcefield */}
      {shieldActive > 0 && shieldHP > 0 && !shipDestroyed && (
        <View style={{
          position: "absolute",
          left: pxp - SHIELD_R - 2, top: pyp - SHIELD_R - 2,
          width: (SHIELD_R + 2) * 2, height: (SHIELD_R + 2) * 2,
        }}>
          {/* Outer ring */}
          <View style={{
            position: "absolute", left: 0, top: 0, right: 0, bottom: 0,
            borderRadius: SHIELD_R + 2, borderWidth: 1.5,
            borderColor: `rgba(116,185,255,${(0.3 + Math.sin(now * 0.005) * 0.15).toFixed(2)})`,
            backgroundColor: "rgba(116,185,255,0.05)",
          }} />
          {/* Hex nodes */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI * 2 / 6) * i + now * 0.001;
            const nx = cos(a) * SHIELD_R;
            const ny = sin(a) * SHIELD_R;
            return (
              <View key={i} style={{
                position: "absolute",
                left: SHIELD_R + 2 + nx - 2, top: SHIELD_R + 2 + ny - 2,
                width: 4, height: 4, borderRadius: 2,
                backgroundColor: `rgba(116,185,255,${(0.5 + Math.sin(now * 0.005) * 0.15).toFixed(2)})`,
              }} />
            );
          })}
          {/* Inner hex nodes */}
          {Array.from({ length: 6 }, (_, i) => {
            const a = (Math.PI * 2 / 6) * i + Math.PI / 6 + now * 0.001;
            const nx = cos(a) * SHIELD_R * 0.6;
            const ny = sin(a) * SHIELD_R * 0.6;
            return (
              <View key={`in${i}`} style={{
                position: "absolute",
                left: SHIELD_R + 2 + nx - 1.5, top: SHIELD_R + 2 + ny - 1.5,
                width: 3, height: 3, borderRadius: 1.5,
                backgroundColor: `rgba(162,155,254,${(0.3 + Math.sin(now * 0.005) * 0.15).toFixed(2)})`,
              }} />
            );
          })}
        </View>
      )}

      {/* Planet shield ring */}
      {planetShield && (
        <View style={{
          position: "absolute",
          left: CX - ORBIT_R - 8, top: CY - ORBIT_R - 8,
          width: (ORBIT_R + 8) * 2, height: (ORBIT_R + 8) * 2,
          borderRadius: ORBIT_R + 8, borderWidth: 3,
          borderColor: `rgba(116,185,255,${(0.4 + Math.sin(now * 0.003) * 0.2).toFixed(2)})`,
        }} />
      )}
    </>
  );
}
