import React from "react";
import { View, Image } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import type { GameState } from "../_shared/types";
import {
  PLANET_R,
  SATELLITE_IMAGE, EARTH_GOLD_IMAGE, EARTH_IMAGES, ATMO_COLORS,
} from "../_shared/constants";
import { gameConfig } from "../_shared/gameConfig";
import { uid, hypot, cos, sin, rand, PI2, floor, min, spawnAsteroidDebris } from "../_shared/helpers";

// ── Planet logic (asteroid↔planet collision, planet explosion) ──────

export function updatePlanet(s: GameState, ts: number): void {
  s.asteroids = s.asteroids.filter((a) => {
    if (hypot(a.x - s.planetX, a.y - s.planetY) < PLANET_R + a.radius) {
      if (!s.immortal) {
        if (a.isBoss) {
          s.planetStage = 5;
        } else {
          s.planetStage = min(5, s.planetStage + 1);
        }
        s.planetFlash = ts;
        s.bulletCount = 1;
        s.destroyedCount = 0;
      }
      if (!a.isBoss) {
        s.asteroidsCleared++;
        spawnAsteroidDebris(s, a);
      }
      for (let i = 0; i < 8; i++) {
        const pa = rand() * PI2;
        s.particles.push({
          id: uid(), x: a.x, y: a.y,
          vx: cos(pa) * (1 + rand() * 2), vy: sin(pa) * (1 + rand() * 2),
          life: 1, color: "#e74c3c",
        });
      }
      return false;
    }
    return true;
  });

  if (s.planetStage >= 5 && !s.planetExploded) {
    s.planetExploded = true;
    s.planetFlash = ts;
    for (let i = 0; i < 40; i++) {
      const ea = rand() * PI2;
      const espd = 2 + rand() * 5;
      s.particles.push({
        id: uid(),
        x: s.planetX + (rand() - 0.5) * PLANET_R, y: s.planetY + (rand() - 0.5) * PLANET_R,
        vx: cos(ea) * espd, vy: sin(ea) * espd, life: 1,
        color: ["#e74c3c", "#f39c12", "#fdcb6e", "#ff7675", "#fff"][floor(rand() * 5)],
      });
    }
    s.gameOver = true;
  }
}

// ── Planet render ───────────────────────────────────────────────────

interface PlanetProps {
  planetExploded: boolean;
  immortal: boolean;
  planetStage: number;
  gameOver: boolean;
  bulletCount: number;
  satelliteCount: number;
  flashOpacity: number;
}

export default function Planet({
  planetExploded, immortal, planetStage, gameOver,
  bulletCount, satelliteCount, flashOpacity,
}: PlanetProps) {
  if (planetExploded) return null;

  const planetImg = immortal ? EARTH_GOLD_IMAGE : (EARTH_IMAGES[planetStage] ?? EARTH_IMAGES[0]);
  const atmoGradient = ATMO_COLORS[planetStage] ?? ATMO_COLORS[1];
  const eScale = immortal ? 2.1 : 1.8;

  return (
    <>
      {/* Atmosphere glow */}
      <View
        style={{
          position: "absolute",
          left: CX - PLANET_R * 2, top: CY - PLANET_R * 2,
          width: PLANET_R * 4, height: PLANET_R * 4,
          borderRadius: PLANET_R * 2, overflow: "hidden",
        }}
      >
        <LinearGradient
          colors={atmoGradient}
          start={{ x: 0.5, y: 0.5 }}
          end={{ x: 0, y: 0 }}
          style={{ width: '100%', height: '100%' }}
        />
      </View>

      {/* Planet image */}
      <View
        style={{
          position: "absolute",
          left: CX - PLANET_R * eScale, top: CY - PLANET_R * eScale,
          width: PLANET_R * eScale * 2, height: PLANET_R * eScale * 2,
          borderRadius: PLANET_R * eScale, overflow: "hidden",
        }}
      >
        <Image source={planetImg} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
      </View>

      {/* White flash on stage change */}
      {flashOpacity > 0 && (
        <View
          style={{
            position: "absolute",
            left: CX - PLANET_R * 1.4, top: CY - PLANET_R * 1.4,
            width: PLANET_R * 2.8, height: PLANET_R * 2.8,
            borderRadius: PLANET_R * 1.4, backgroundColor: "#fff", opacity: flashOpacity,
          }}
        />
      )}

      {/* Satellite buy icon */}
      {!gameOver && bulletCount >= 5 && satelliteCount < gameConfig.maxSatellites && (
        <View style={{
          position: "absolute", left: CX - 14, top: CY - 14, width: 28, height: 28,
          opacity: 0.7 + Math.sin(performance.now() * 0.004) * 0.3,
        }}>
          <Image source={SATELLITE_IMAGE} style={{ width: 28, height: 28 }} resizeMode="contain" />
        </View>
      )}
    </>
  );
}
