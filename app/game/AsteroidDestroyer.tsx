import React, { useCallback, useEffect, useRef, useState } from "react";
import { View, Text, Platform, StatusBar } from "react-native";
import { useRouter } from "expo-router";
import { useAudioSettings } from "../../context/AudioSettingsContext";
import { Canvas, Group } from "@shopify/react-native-skia";

import type { GameState, SpecialWeapon, Upgrades } from "./_shared/types";
import type { GameSession } from "../../services/gameService";
import * as GameService from "../../services/gameService";
import { recordCheckpoint, recordBossDefeat } from "../../services/progressService";
import { applyServerConfig, gameConfig } from "./_shared/gameConfig";
import {
  GW, GH, OX, OY, CX, CY, PLANET_R, ORBIT_R,
  FIRE_COOLDOWN, WAVE_SPEED, WAVE_MAX_R, OOB,
  MAX_LEVEL, BULLET_SPEED, MAX_BULLETS, PLAYER_H, SHIELD_MAX_HP,
  EXPLOSION_COLORS,
} from "./_shared/constants";

const IS_MOBILE = Platform.OS !== "web";
const RENDER_INTERVAL = IS_MOBILE ? 33 : 0;

import {
  uid, resetUid, cos, sin, atan2, rand, PI, PI2,
  max, min, hypot, floor, abs,
  initState, startLevel, startWave, getLevelConfig,
  mkAsteroid, mkRainAsteroid, mkMiniBoss, mkBoss,
  advanceMultiplier, resetMultiplier, isMercuryLevel, damageShip,
  addScorePopup, bossDamage, spawnBossDebris,
} from "./_shared/helpers";

import { updatePlanet } from "./_components/Planet";
import { updateSatellites } from "./_components/Satelites";
import { updatePowerUps } from "./_components/PowerUps";
import { updateAsteroids } from "./_components/Asteroid";
import { updateShip } from "./_components/Ship";
import { updateAlienFighters, updateAlienDiscs } from "./_components/AlienFighter";
import { updateAlienDrones } from "./_components/AlienDrone";
import { updateBossAlien } from "./_components/BossAlien";
import HUD from "./_components/HUD";
import GameOverlay from "./_components/GameOver";
import SelectionOverlay from "./_components/SelectionOverlay";
import UpgradeOverlay, { getUpgradeCost, getSellValue } from "./_components/UpgradeOverlay";

import { useSkiaImages } from "./_hooks/useSkiaImages";
import { useGameAudio } from "./_hooks/useGameAudio";
import { useFireWeapons } from "./_hooks/useFireWeapons";
import { useInputHandlers } from "./_hooks/useInputHandlers";
import { Background } from "./_components/Background";
import { PlanetRenderer } from "./_components/PlanetRenderer";
import { SatelliteRenderer } from "./_components/SatelliteRenderer";
import { AsteroidRenderer } from "./_components/AsteroidRenderer";
import { AlienRenderer } from "./_components/AlienRenderer";
import { BossAlienRenderer } from "./_components/BossAlienRenderer";
import { PlayerRenderer } from "./_components/PlayerRenderer";
import { ShieldRenderer } from "./_components/ShieldRenderer";
import { WeaponEffects } from "./_components/WeaponEffects";
import { ParticlesRenderer } from "./_components/ParticlesRenderer";
import { ScorePopups } from "./_components/ScorePopups";
import { BossHealthBar } from "./_components/BossHealthBar";

// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•
//  AsteroidDestroyer â€“ thin orchestrator
//  All entity logic lives in the respective _components/*.tsx files.
//  This file handles: game-loop timing, state orchestration, render.
// â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•â•

export default function AsteroidDestroyer({ modeConfig }: { modeConfig?: import('./_shared/types').GameModeConfig }) {
  const router = useRouter();
  const { musicVolume, sfxVolume } = useAudioSettings();
  const [tick, setTick] = useState(0);

  const gs = useRef<GameState>(initState(performance.now(), modeConfig));
  const sessionIdRef = useRef<number | null>(null);
  const lastSyncedLevel = useRef(1);
  const pointer = useRef({ x: CX, y: CY - ORBIT_R });
  const fireQueue = useRef<number[]>([]);
  const specialQueue = useRef<number[]>([]);
  const bumperHeld = useRef(false);
  const lastFire = useRef(0);
  const raf = useRef(0);
  const lastRender = useRef(0);

  /** Apply authoritative fields from backend session onto local game state */
  const applySession = useCallback((sess: GameSession) => {
    const sc = gs.current;
    sc.score = sess.score;
    sc.upgrades = { ...sess.upgrades };
    sc.unlockedSkins = new Set(sess.unlockedSkins);
    sc.unlockedPlasma = new Set(sess.unlockedPlasma);
    sc.shipColor = sess.shipColor as GameState["shipColor"];
    sc.laserColor = sess.laserColor as GameState["laserColor"];
    // Reconcile satellite count
    while (sc.satellites.length > sess.satelliteCount) sc.satellites.pop();
    while (sc.satellites.length < sess.satelliteCount) {
      sc.satellites.push({
        id: uid(), angle: sc.playerAngle + PI,
        targetAngle: sc.playerAngle + PI, lastFire: 0, shieldActive: false,
      });
    }
    // Reconcile shield from upgrade level
    sc.forceFieldMaxHP = sc.upgrades.shieldLevel * 25;
    sc.forceFieldHP = Math.min(sc.forceFieldHP, sc.forceFieldMaxHP);
  }, []);

  // â”€â”€â”€ Extracted hooks â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const {
    imgBg, imgShipGold, imgPhotonBlue, imgWaveArc,
    imgSatellite, imgSatGold, imgEarth, imgEarthGold,
    planetImageMap, imgAlienBlue, imgAlienRed, imgAlienDisc,
    imgDroneBlue, imgDroneRed, imgBossAlien, imgBossAlienAwake,
    imgBossAlienRed, imgBossAlienRedAwake, imgBrownAst, imgBoss,
    imgDebris, imgPower, astImgMap, shipImgs, ready,
  } = useSkiaImages();

  const { playLaserSfx } = useGameAudio(musicVolume, sfxVolume);

  const {
    fire, fireSpecial,
    startMagnet, releaseMagnet,
    startPlasmaCharge, releasePlasmaCharge,
    chargeHeld, magnetHeld,
  } = useFireWeapons(gs, pointer, playLaserSfx);

  useInputHandlers(
    gs, pointer, fireQueue, specialQueue, bumperHeld,
    fireSpecial, startPlasmaCharge, releasePlasmaCharge,
    startMagnet, releaseMagnet,
  );

  // â”€â”€â”€ Game loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const loop = useCallback((ts: number) => {
    const s = gs.current;
    const alive = !s.gameOver && !s.won;

    // ── Time Attack timer ──
    if (alive && s.modeConfig?.timed && !s.shipDestroyed && !s.levelComplete) {
      s.elapsedMs = ts - s.startTime;
    }

    if (s.won) { setTick((t) => t + 1); return; }
    if (s.showColorMenu || s.upgradeMenuOpen) {
      setTick((t) => t + 1);
      raf.current = requestAnimationFrame(loop);
      return;
    }

    // â”€â”€â”€ Travel phase (bonus level between planets â†’ 11 transition) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if (s.travelPhase) {
      const elapsed = ts - s.travelStart;
      const DEPART_DUR = 3000;
      const TRAVEL_DUR = 24000;
      const ARRIVE_DUR = 3000;
      // Smooth-step easing: accelerates then decelerates
      const ease = (x: number) => x * x * (3 - 2 * x);

      if (s.travelPhase === 'departing') {
        // Ship flies upward away from planet, planet slides down
        const t = ease(Math.min(1, elapsed / DEPART_DUR));
        s.travelShipX = s.travelDepartX + (CX - s.travelDepartX) * t;
        s.travelShipY = s.travelDepartY + (GH * 0.7 - s.travelDepartY) * t;
        s.planetY = CY + GH * 0.8 * t;
        if (elapsed >= DEPART_DUR) {
          s.travelPhase = 'traveling';
          s.travelStart = ts;
          s.travelShipX = CX;
          s.travelShipY = GH * 0.7;
          s.planetExploded = true; // hide planet during travel
          s.travelAsteroids = [];
        }
      } else if (s.travelPhase === 'traveling') {
        // Scroll background & stars downward
        s.travelBgOffset += 4;
        // Spawn diagonal asteroids from top-left
        if (elapsed < TRAVEL_DUR && rand() < 0.12) {
          const spawnX = rand() * GW * 0.8;
          const spawnY = -30;
          const spd = 3 + rand() * 4;
          const angle = PI * 0.3 + rand() * PI * 0.4; // ~55Â° to ~125Â° (top-left to bottom-right range)
          s.travelAsteroids.push({
            id: uid(), x: spawnX, y: spawnY,
            vx: cos(angle) * spd, vy: sin(angle) * spd,
            radius: 10 + rand() * 25, rotation: rand() * PI2,
            rotSpeed: (rand() - 0.5) * 0.05, sprite: floor(rand() * 3),
          });
        }
        // Move travel asteroids
        for (const a of s.travelAsteroids) {
          a.x += a.vx; a.y += a.vy; a.rotation += a.rotSpeed;
        }
        s.travelAsteroids = s.travelAsteroids.filter(
          a => a.x > -50 && a.x < GW + 50 && a.y > -50 && a.y < GH + 50
        );
        // Check collision with ship
        const SHIP_R = 16;
        if (!s.shipDestroyed) {
          for (const a of s.travelAsteroids) {
            if (hypot(a.x - s.travelShipX, a.y - s.travelShipY) < a.radius + SHIP_R) {
              a.y = GH + 100; // remove asteroid
              damageShip(s, ts, s.travelShipX, s.travelShipY, 25);
            }
          }
        }
        // Ship destroyed during travel â€” 2s delay then game over
        if (s.shipDestroyed && !s.gameOver && s.shipExplodeTime > 0 && ts - s.shipExplodeTime > 2000) {
          s.gameOver = true;
        }
        // Dragging ship during travel
        if (s.draggingShip) {
          s.travelShipX = max(20, min(GW - 20, pointer.current.x));
          s.travelShipY = max(20, min(GH - 20, pointer.current.y));
        }
        // Wait for spawn timer AND all asteroids off screen before arriving
        if (elapsed >= TRAVEL_DUR && s.travelAsteroids.length === 0) {
          s.travelDepartX = s.travelShipX;
          s.travelDepartY = s.travelShipY;
          s.travelArriveOffset = s.travelBgOffset;
          s.travelPhase = 'arriving';
          s.travelStart = ts;
        }
      } else if (s.travelPhase === 'arriving') {
        // Moon appears from top, ship curves to orbit position
        const t = ease(Math.min(1, elapsed / ARRIVE_DUR));
        s.planetExploded = false;
        s.planetX = CX;
        s.planetY = -PLANET_R * 4 + (CY + PLANET_R * 4) * t;
        // Ship smoothly curves to orbit position at top of moon
        const orbitAngle = -PI / 2;
        const targetX = s.planetX + ORBIT_R * cos(orbitAngle);
        const targetY = s.planetY + ORBIT_R * sin(orbitAngle);
        // Interpolate from ship's actual position when arriving started
        s.travelShipX = s.travelDepartX + (targetX - s.travelDepartX) * t;
        s.travelShipY = s.travelDepartY + (targetY - s.travelDepartY) * t;
        // Ease bg offset to nearest multiple of GH so it aligns with static bg
        const targetOff = Math.ceil(s.travelArriveOffset / GH) * GH;
        s.travelBgOffset = s.travelArriveOffset + (targetOff - s.travelArriveOffset) * t;
        if (elapsed >= ARRIVE_DUR) {
          // Complete: start first level on the new planet
          s.travelPhase = null;
          s.travelBgOffset = 0;
          s.draggingShip = false;
          fireQueue.current = [];
          specialQueue.current = [];
          s.planetExploded = false;
          s.planetX = CX;
          s.planetY = CY;
          s.planetStage = 1;
          s.playerAngle = -PI / 2;
          s.shipTargetAngle = -PI / 2;
          s.upgradePoints++;
          s.levelComplete = true;
          startLevel(s, s.level + 1, ts);
        }
      }

      // Update particles & debris during travel so explosions render
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life -= 0.035; }
      s.particles = s.particles.filter((p) => p.life > 0);
      for (const d of s.debris) { d.x += d.vx; d.y += d.vy; d.rotation += d.rotSpeed; d.life -= 0.02; }
      s.debris = s.debris.filter((d) => d.life > 0);

      if (!IS_MOBILE || ts - lastRender.current >= RENDER_INTERVAL) {
        lastRender.current = ts;
        setTick((t) => t + 1);
      }
      raf.current = requestAnimationFrame(loop);
      return;
    }

    // ─── Immortal phase ─────────────────────────────────────────────
    if (s.immortalPhase) {
      const elapsed = ts - s.immortalStart;
      const DEPART_DUR = gameConfig.immortalDepartDur;
      const RETURN_DUR = gameConfig.immortalReturnDur;
      const ease2 = (x: number) => x * x * (3 - 2 * x);

      if (s.immortalPhase === 'departing') {
        const t = ease2(Math.min(1, elapsed / DEPART_DUR));
        s.immortalShipX = s.immortalDepartX + (CX - s.immortalDepartX) * t;
        s.immortalShipY = s.immortalDepartY + (GH * 0.5 - s.immortalDepartY) * t;
        s.planetY = s.immortalSavedPlanetY + (GH + PLANET_R * 2) * t;

        // Slow down existing asteroids
        for (const a of s.asteroids) { a.vx *= 0.96; a.vy *= 0.96; }

        // Energy charge particles
        if (rand() < 0.4) {
          const pa2 = rand() * PI2;
          const dist = 30 + rand() * 60;
          s.particles.push({
            id: uid(), x: s.immortalShipX + cos(pa2) * dist, y: s.immortalShipY + sin(pa2) * dist,
            vx: -cos(pa2) * 2, vy: -sin(pa2) * 2, life: 0.6, color: '#ffd700',
          });
        }

        if (elapsed >= DEPART_DUR) {
          s.immortalPhase = 'active';
          s.immortalStart = ts;
          s.planetExploded = true;
          s.draggingShip = false;
          s.asteroids = [];
          s.bullets = [];
          s.immortalShipX = CX;
          s.immortalShipY = GH * 0.75;
          s.playerAngle = -PI / 2;
          s.travelBgOffset = 0;
          s.immortalWave = 1;
          s.immortalWaveStart = ts;
          s.immortalSpiralAngle = 0;
          s.immortalSpiralCenterY = 0;
          s.immortalBoss = false;
          s.bossSpawned = false;
          s.bossDefeated = false;
          s.bossDefeatTime = 0;
          s.levelBanner = ts;
          // Spawn wave 1: dense field ABOVE the screen
          const cfg1 = getLevelConfig(s.level);
          const w1Count = max(80, min(120, cfg1.asteroids * 2));
          for (let i = 0; i < w1Count; i++) {
            const ax = 15 + rand() * (GW - 30);
            const ay = -(rand() * GH * 0.3 + 30);
            const r2 = 15 + rand() * 25;
            const at = rand() < 0.005 ? 'crystal' as const : rand() < 0.10 ? 'red' as const : rand() < 0.40 ? 'blue' as const : 'brown' as const;
            const hp = at === 'crystal' ? 1 : (s.level <= 3 ? 1 : s.level <= 7 ? 2 : 3);
            s.asteroids.push({
              id: uid(), x: ax, y: ay,
              vx: (rand() - 0.5) * 0.4, vy: 0, radius: r2,
              sprite: floor(rand() * 2), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
              hp, maxHP: hp, asteroidType: at,
            });
          }
        }
      } else if (s.immortalPhase === 'active') {
        const phaseElapsed = ts - s.immortalStart;
        const IMMORTAL_DUR = gameConfig.immortalDuration;
        const FLY_SPEED = 8;  // ship's forward velocity (px per frame)

        // ── Scrolling background (pause during boss fight) ──
        if (!s.immortalBoss) s.travelBgOffset += FLY_SPEED;

        // ── Boss fight: boss drifts down slowly, stops at GH*0.25 ──
        if (s.immortalBoss) {
          for (const a of s.asteroids) {
            if (a.isBoss) {
              if (a.y < GH * 0.25) a.y += 0.8;
            } else {
              a.y += a.vy;
              a.x += a.vx;
            }
            a.rotation += a.rotSpeed;
          }
          // Boss defeated → short delay then advance
          if (s.bossDefeated && s.bossDefeatTime > 0 && ts - s.bossDefeatTime >= 1500) {
            recordBossDefeat(s.level);
            s.immortalBoss = false;
            s.bossSpawned = false;
            s.bossDefeated = false;
            s.bossDefeatTime = 0;
            s.asteroids = [];
            s.immortalWave = 1;
            s.immortalWaveStart = ts;
            s.levelBanner = ts;
            // Spawn wave 1 for the new level
            const cfgB = getLevelConfig(s.level);
            const countB = max(80, min(120, cfgB.asteroids * 2));
            for (let i = 0; i < countB; i++) {
              const ax = 15 + rand() * (GW - 30);
              const ay = -(rand() * GH * 0.3 + 30);
              const r2 = 15 + rand() * 25;
              const at = rand() < 0.005 ? 'crystal' as const : rand() < 0.10 ? 'red' as const : rand() < 0.40 ? 'blue' as const : 'brown' as const;
              const hp = at === 'crystal' ? 1 : (s.level <= 3 ? 1 : s.level <= 7 ? 2 : 3);
              s.asteroids.push({
                id: uid(), x: ax, y: ay,
                vx: (rand() - 0.5) * 0.4, vy: 0, radius: r2,
                sprite: floor(rand() * 2), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
                hp, maxHP: hp, asteroidType: at,
              });
            }
          }
        } else if (s.immortalWave === 3) {
          // Wave 3: spiral center drifts down continuously (flies past)
          s.immortalSpiralCenterY += FLY_SPEED;
          s.immortalSpiralAngle += 0.012;
          const spiralGap = 100;
          const spiralB = spiralGap / PI2;
          for (const a of s.asteroids) {
            if (a.isOrbiting && a.orbitAngle !== undefined) {
              const theta = a.orbitAngle + s.immortalSpiralAngle;
              const r = spiralB * a.orbitAngle;  // Archimedean: r = b * θ₀
              a.x = CX + cos(theta) * r;
              a.y = s.immortalSpiralCenterY + sin(theta) * r;
            }
            a.rotation += a.rotSpeed;
          }
        } else {
          // Wave 1 & 2: fly downward continuously (past the ship)
          for (const a of s.asteroids) {
            a.y += FLY_SPEED;
            if (a.isRain) a.y += a.vy;
            a.x += a.vx;
            a.rotation += a.rotSpeed;
            // Gentle horizontal bounce
            if (a.x < a.radius) { a.x = a.radius; a.vx = abs(a.vx); }
            if (a.x > GW - a.radius) { a.x = GW - a.radius; a.vx = -abs(a.vx); }
          }
        }

        // Remove asteroids that passed well below the screen
        s.asteroids = s.asteroids.filter(a => a.radius > 0 && (a.isBoss || a.y < GH + a.radius + 100));

        // ── Wave advancement: all asteroids cleared → next wave immediately ──
        if (s.asteroids.length === 0 && !s.immortalBoss) {
          const prevW = s.immortalWave;
          if (prevW < 3) {
            s.immortalWave = (prevW + 1) as 1 | 2 | 3;
          } else {
            s.upgradePoints++;
            if (s.level < MAX_LEVEL) s.level++;
            s.immortalWave = 1;
          }
          s.immortalWaveStart = ts;
          s.immortalSpiralAngle = 0;
          s.levelBanner = ts;  // show wave/level banner

          const cfg = getLevelConfig(s.level);

          // Boss level → spawn boss instead of wave asteroids
          if (cfg.boss && s.immortalWave === 1) {
            s.immortalBoss = true;
            s.bossSpawned = true;
            s.bossDefeated = false;
            s.bossDefeatTime = 0;
            s.asteroids.push(mkBoss(s.level));
          } else if (s.immortalWave === 1) {
            // Wave 1: dense asteroid field above screen
            const count = max(80, min(120, cfg.asteroids * 2));
            for (let i = 0; i < count; i++) {
              const ax = 15 + rand() * (GW - 30);
              const ay = -(rand() * GH * 0.3 + 30);
              const r2 = 15 + rand() * 25;
              const at = rand() < 0.005 ? 'crystal' as const : rand() < 0.10 ? 'red' as const : rand() < 0.40 ? 'blue' as const : 'brown' as const;
              const hp = at === 'crystal' ? 1 : (s.level <= 3 ? 1 : s.level <= 7 ? 2 : 3);
              s.asteroids.push({
                id: uid(), x: ax, y: ay,
                vx: (rand() - 0.5) * 0.4, vy: 0, radius: r2,
                sprite: floor(rand() * 2), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
                hp, maxHP: hp, asteroidType: at,
              });
            }
          } else if (s.immortalWave === 2) {
            // Wave 2: fast rain — dense, with extra downward velocity
            const count = max(80, min(120, floor(cfg.asteroids * 1.5)));
            for (let i = 0; i < count; i++) {
              const spawnX = 10 + rand() * (GW - 20);
              const spawnY = -(rand() * GH * 0.3 + 30);
              const extraVy = 2 + rand() * 3 + s.level * 0.05;
              const r2 = 15 + rand() * 25;
              const at = rand() < 0.005 ? 'crystal' as const : rand() < 0.10 ? 'red' as const : rand() < 0.40 ? 'blue' as const : 'brown' as const;
              const hp = at === 'crystal' ? 1 : (s.level <= 3 ? 1 : s.level <= 7 ? 2 : 3);
              s.asteroids.push({
                id: uid(), x: spawnX, y: spawnY,
                vx: (rand() - 0.5) * 0.5, vy: extraVy, radius: r2,
                sprite: floor(rand() * 2), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
                hp, maxHP: hp, asteroidType: at, isRain: true,
              });
            }
          } else {
            // Wave 3: Archimedean spiral galaxy placed above, drifts down spinning
            const spiralGap = 100;
            const spiralB = spiralGap / PI2;
            const count = 60;
            s.immortalSpiralCenterY = -(GH * 0.3);
            for (let i = 0; i < count; i++) {
              const theta = (i / count) * 6 * PI;  // 3 full turns
              const r = spiralB * theta;
              const ax = CX + cos(theta) * r;
              const ay = s.immortalSpiralCenterY + sin(theta) * r;
              const r2 = 15 + rand() * 20;
              const at = rand() < 0.005 ? 'crystal' as const : rand() < 0.10 ? 'red' as const : rand() < 0.40 ? 'blue' as const : 'brown' as const;
              const hp = at === 'crystal' ? 1 : (s.level <= 3 ? 1 : s.level <= 7 ? 2 : 3);
              s.asteroids.push({
                id: uid(), x: ax, y: ay, vx: 0, vy: 0, radius: r2,
                sprite: floor(rand() * 2), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
                hp, maxHP: hp, asteroidType: at,
                isOrbiting: true, orbitAngle: theta, orbitRadius: r, orbitSpeed: 0,
              });
            }
          }
        }

        // Dragging ship (free movement) — always faces upward
        if (s.draggingShip) {
          s.immortalShipX = max(20, min(GW - 20, pointer.current.x));
          s.immortalShipY = max(20, min(GH - 20, pointer.current.y));
        }
        s.playerAngle = -PI / 2; // always face up (flying forward)

        // Auto-fire blasters upward — always 10 in cone spread
        const autoCD = gameConfig.immortalAutoFireCD;
        if (ts - s.immortalAutoFireLast > autoCD && s.bullets.length < MAX_BULLETS) {
          s.immortalAutoFireLast = ts;
          const fireA = -PI / 2;
          const count = 10;
          const CONE_HALF = 0.35;  // ~40° total cone
          const homingStr = s.upgrades.homingLevel * 0.008;
          const vid = uid();
          for (let i = 0; i < count; i++) {
            const spread = count > 1 ? -CONE_HALF + (2 * CONE_HALF * i) / (count - 1) : 0;
            const ba = fireA + spread;
            s.bullets.push({
              id: uid(), volley: vid,
              x: s.immortalShipX + cos(fireA) * PLAYER_H * 0.6,
              y: s.immortalShipY + sin(fireA) * PLAYER_H * 0.6,
              vx: cos(ba) * BULLET_SPEED, vy: sin(ba) * BULLET_SPEED,
              homing: homingStr,
            });
          }
        }

        // Maintain shield & refresh ammo
        s.shieldActive = ts + 999999;
        s.shieldHP = max(s.shieldHP, SHIELD_MAX_HP);
        s.missileCount = max(s.missileCount, 5);
        s.waveAmmo = max(s.waveAmmo, 20);
        s.plasmaAmmo = max(s.plasmaAmmo, 5);
        s.crossLaserAmmo = max(s.crossLaserAmmo, 5);
        s.chainLightningAmmo = max(s.chainLightningAmmo, 5);
        s.discLauncherAmmo = max(s.discLauncherAmmo, 5);
        s.magnetAmmo = max(s.magnetAmmo, 5);

        // Bullet physics
        const onScr = (o: {x:number,y:number,radius:number}) =>
          o.x + o.radius > 0 && o.x - o.radius < GW && o.y + o.radius > 0 && o.y - o.radius < GH;
        for (const b of s.bullets) {
          if (b.homing > 0) {
            let nd = 999999, nx = 0, ny = 0, found = false;
            for (const a of s.asteroids) {
              if (!onScr(a)) continue;
              const d = hypot(a.x - b.x, a.y - b.y);
              if (d < nd) { nd = d; nx = a.x; ny = a.y; found = true; }
            }
            if (found && nd < 300) {
              const toA2 = atan2(ny - b.y, nx - b.x);
              const curA = atan2(b.vy, b.vx);
              let diff = toA2 - curA;
              while (diff > PI) diff -= PI2;
              while (diff < -PI) diff += PI2;
              const spd2 = hypot(b.vx, b.vy);
              const newA = curA + diff * b.homing;
              b.vx = cos(newA) * spd2; b.vy = sin(newA) * spd2;
            }
          }
          b.x += b.vx; b.y += b.vy;
        }
        s.bullets = s.bullets.filter(b => b.x > -OOB && b.x < GW + OOB && b.y > -OOB && b.y < GH + OOB);

        // Bullet ↔ asteroid collision (on-screen only)
        const deadB = new Set<number>();
        for (const b of s.bullets) {
          for (const a of s.asteroids) {
            if (a.radius <= 0 || !onScr(a)) continue;
            if (hypot(b.x - a.x, b.y - a.y) < a.radius + 4) {
              deadB.add(b.id);
              if (a.isBoss && a.bossHP !== undefined) {
                a.bossFlash = ts;
                const result = bossDamage(a, 1);
                if (result === 'dead') {
                  const bossPts = floor(gameConfig.bossAsteroidPoints * s.multiplier);
                  s.score += bossPts;
                  addScorePopup(s, a.x, a.y, bossPts);
                  s.bossDefeated = true;
                  s.bossDefeatTime = ts;
                  for (let i2 = 0; i2 < 30; i2++) { const pa2 = rand() * PI2; const pspd = 2 + rand() * 4; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * pspd, vy: sin(pa2) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] }); }
                  spawnBossDebris(s, a);
                  a.radius = -1;
                }
                for (let i2 = 0; i2 < 3; i2++) { const pa2 = rand() * PI2; s.particles.push({ id: uid(), x: b.x, y: b.y, vx: cos(pa2) * 2, vy: sin(pa2) * 2, life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] }); }
              } else {
                a.hp--;
                if (a.hp <= 0) {
                  a.radius = -1;
                  s.destroyedCount++;
                  s.asteroidsCleared++;
                  const pts = floor(25 * s.multiplier);
                  s.score += pts;
                  addScorePopup(s, a.x, a.y, pts);
                  advanceMultiplier(s);
                  for (let i2 = 0; i2 < 6; i2++) {
                    const pa2 = rand() * PI2;
                    s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.5, color: '#7efaff' });
                  }
                } else {
                  s.hitVolleys.add(b.volley);
                  advanceMultiplier(s);
                }
              }
              break;
            }
          }
        }
        s.bullets = s.bullets.filter(b => !deadB.has(b.id));
        s.asteroids = s.asteroids.filter(a => a.radius > 0);

        // Ship ↔ asteroid (shield absorbs — skip boss)
        const SHIP_R2 = 16;
        for (const a of s.asteroids) {
          if (a.radius <= 0 || a.isBoss) continue;
          if (hypot(a.x - s.immortalShipX, a.y - s.immortalShipY) < SHIP_R2 + a.radius) {
            a.radius = -1;
            s.destroyedCount++;
            for (let i2 = 0; i2 < 5; i2++) {
              const pa2 = rand() * PI2;
              s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 2, vy: sin(pa2) * 2, life: 0.5, color: '#74b9ff' });
            }
          }
        }
        s.asteroids = s.asteroids.filter(a => a.radius > 0);

        // Wave (arc) physics
        for (const w of s.waves) w.radius += WAVE_SPEED;
        s.waves = s.waves.filter(w => w.radius < WAVE_MAX_R);

        // Plasma pulse physics
        for (const p2 of s.plasmaPulses) p2.radius += 6;
        s.plasmaPulses = s.plasmaPulses.filter(p2 => p2.radius < p2.maxRadius);

        // Cross laser & charged plasma time cleanup
        const nowImm = performance.now();
        s.crossLasers = s.crossLasers.filter(cl => nowImm < cl.startTime + cl.duration);
        s.chargedPlasmas = s.chargedPlasmas.filter(cp => nowImm < cp.startTime + cp.duration);
        s.chainLightnings = s.chainLightnings.filter(cl => nowImm < cl.startTime + cl.duration);

        // ── Wave ↔ asteroid collision (on-screen only) ──
        for (const w of s.waves) {
          s.asteroids = s.asteroids.filter(a => {
            if (a.radius <= 0 || !onScr(a)) return true;
            const dx = a.x - w.x; const dy = a.y - w.y;
            const dist = hypot(dx, dy);
            if (dist < w.radius + a.radius && dist > w.radius - a.radius * 2 && !w.hit.has(a.id)) {
              const angleToA = atan2(dy, dx);
              let angleDiff = angleToA - w.angle;
              while (angleDiff > PI) angleDiff -= PI2;
              while (angleDiff < -PI) angleDiff += PI2;
              const angularR = dist > 0 ? atan2(a.radius, dist) : PI;
              if (abs(angleDiff) < w.arcWidth / 2 + angularR) {
                w.hit.add(a.id);
                if (a.isBoss && a.bossHP !== undefined) {
                  a.bossFlash = ts;
                  const result = bossDamage(a, 3);
                  if (result === 'dead') {
                    const bossPts = floor(gameConfig.bossAsteroidPoints * s.multiplier);
                    s.score += bossPts; addScorePopup(s, a.x, a.y, bossPts);
                    s.bossDefeated = true; s.bossDefeatTime = ts;
                    for (let i2 = 0; i2 < 30; i2++) { const pa2 = rand() * PI2; const pspd = 2 + rand() * 4; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * pspd, vy: sin(pa2) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] }); }
                    spawnBossDebris(s, a); a.radius = -1; return false;
                  }
                } else {
                  a.hp--;
                  if (a.hp <= 0) {
                    a.radius = -1; s.destroyedCount++; s.asteroidsCleared++;
                    const pts = floor(25 * s.multiplier);
                    s.score += pts; addScorePopup(s, a.x, a.y, pts); advanceMultiplier(s);
                    for (let i2 = 0; i2 < 6; i2++) { const pa2 = rand() * PI2; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.5, color: '#ff6b6b' }); }
                    return false;
                  }
                }
              }
            }
            return true;
          });
        }

        // ── Plasma pulse ↔ asteroid collision (on-screen only) ──
        for (const pp of s.plasmaPulses) {
          s.asteroids = s.asteroids.filter(a => {
            if (pp.hit.has(a.id) || a.radius <= 0 || !onScr(a)) return true;
            if (hypot(a.x - pp.x, a.y - pp.y) < pp.radius + a.radius) {
              pp.hit.add(a.id);
              if (a.isBoss && a.bossHP !== undefined) {
                a.bossFlash = ts;
                const result = bossDamage(a, 5);
                if (result === 'dead') {
                  const bossPts = floor(gameConfig.bossAsteroidPoints * s.multiplier);
                  s.score += bossPts; addScorePopup(s, a.x, a.y, bossPts);
                  s.bossDefeated = true; s.bossDefeatTime = ts;
                  for (let i2 = 0; i2 < 30; i2++) { const pa2 = rand() * PI2; const pspd = 2 + rand() * 4; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * pspd, vy: sin(pa2) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] }); }
                  spawnBossDebris(s, a); a.radius = -1; return false;
                }
              } else {
                a.radius = -1; s.destroyedCount++; s.asteroidsCleared++;
                const pts = floor(25 * s.multiplier);
                s.score += pts; addScorePopup(s, a.x, a.y, pts); advanceMultiplier(s);
                for (let i2 = 0; i2 < 6; i2++) { const pa2 = rand() * PI2; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.6, color: '#ffa502' }); }
                return false;
              }
            }
            return true;
          });
        }

        // ── Cross laser ↔ asteroid collision ──
        for (const cl of s.crossLasers) {
          if (nowImm > cl.startTime + cl.duration) continue;
          const clElapsed = nowImm - cl.startTime;
          const sweepPct = min(1, clElapsed / cl.duration);
          const beamLen = max(GW, GH) * 2;
          const halfW = 3.5;
          const clx = s.immortalShipX;
          const cly = s.immortalShipY;
          const clAngle = s.playerAngle;
          for (const spread of cl.spreads) {
            const angle = clAngle + spread * (1 - sweepPct * 2);
            const bdx = cos(angle); const bdy = sin(angle);
            s.asteroids = s.asteroids.filter(a => {
              if (cl.hit.has(a.id) || a.radius <= 0 || !onScr(a)) return true;
              const fx = a.x - clx; const fy = a.y - cly;
              const t = fx * bdx + fy * bdy;
              if (t < 0 || t > beamLen) return true;
              const dist = hypot(a.x - (clx + bdx * t), a.y - (cly + bdy * t));
              if (dist < halfW + a.radius) {
                cl.hit.add(a.id);
                if (a.isBoss && a.bossHP !== undefined) {
                  a.bossFlash = ts;
                  const result = bossDamage(a, 15);
                  if (result === 'dead') {
                    const bossPts = floor(gameConfig.bossAsteroidPoints * s.multiplier);
                    s.score += bossPts; addScorePopup(s, a.x, a.y, bossPts);
                    s.bossDefeated = true; s.bossDefeatTime = ts;
                    for (let i2 = 0; i2 < 30; i2++) { const pa2 = rand() * PI2; const pspd = 2 + rand() * 4; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * pspd, vy: sin(pa2) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] }); }
                    spawnBossDebris(s, a); a.radius = -1; return false;
                  }
                } else {
                  a.radius = -1; s.destroyedCount++; s.asteroidsCleared++;
                  const pts = floor(25 * s.multiplier);
                  s.score += pts; addScorePopup(s, a.x, a.y, pts); advanceMultiplier(s);
                  for (let i2 = 0; i2 < 6; i2++) { const pa2 = rand() * PI2; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.5, color: '#fdcb6e' }); }
                  return false;
                }
              }
              return true;
            });
          }
        }

        // ── Charged plasma beam ↔ asteroid collision (on-screen only) ──
        for (const cp of s.chargedPlasmas) {
          if (nowImm > cp.startTime + cp.duration) continue;
          const bdx = cos(cp.angle); const bdy = sin(cp.angle);
          const halfW = cp.width * 0.5 + 2;
          s.asteroids = s.asteroids.filter(a => {
            if (cp.hit.has(a.id) || a.radius <= 0 || !onScr(a)) return true;
            const fx = a.x - cp.x; const fy = a.y - cp.y;
            const t = fx * bdx + fy * bdy;
            if (t < 0) return true;
            const dist = hypot(a.x - (cp.x + bdx * t), a.y - (cp.y + bdy * t));
            if (dist < halfW + a.radius) {
              cp.hit.add(a.id);
              if (a.isBoss && a.bossHP !== undefined) {
                a.bossFlash = ts;
                const result = bossDamage(a, cp.damage);
                if (result === 'dead') {
                  const bossPts = floor(gameConfig.bossAsteroidPoints * s.multiplier);
                  s.score += bossPts; addScorePopup(s, a.x, a.y, bossPts);
                  s.bossDefeated = true; s.bossDefeatTime = ts;
                  for (let i2 = 0; i2 < 30; i2++) { const pa2 = rand() * PI2; const pspd = 2 + rand() * 4; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * pspd, vy: sin(pa2) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] }); }
                  spawnBossDebris(s, a); a.radius = -1; return false;
                }
              } else {
                a.radius = -1; s.destroyedCount++; s.asteroidsCleared++;
                const pts = floor(25 * s.multiplier);
                s.score += pts; addScorePopup(s, a.x, a.y, pts); advanceMultiplier(s);
                for (let i2 = 0; i2 < 6; i2++) { const pa2 = rand() * PI2; s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.5, color: '#a29bfe' }); }
                return false;
              }
            }
            return true;
          });
        }
        s.asteroids = s.asteroids.filter(a => a.radius > 0);

        // ── Process special weapon queue immediately (no rotation needed) ──
        if (specialQueue.current.length > 0) {
          fireSpecial();
          specialQueue.current.shift();
        }

        // Check if immortal phase is ending (30s timer)
        if (phaseElapsed >= IMMORTAL_DUR) {
          s.immortalPhase = 'returning';
          s.immortalStart = ts;
          s.immortalDepartX = s.immortalShipX;
          s.immortalDepartY = s.immortalShipY;
          s.asteroids = [];
          s.bullets = [];
          s.draggingShip = false;
          s.immortalBoss = false;
          s.bossSpawned = false;
          s.bossDefeated = false;
          s.bossDefeatTime = 0;
        }
      } else if (s.immortalPhase === 'returning') {
        const t = ease2(Math.min(1, elapsed / RETURN_DUR));
        s.planetExploded = false;
        s.planetX = CX;
        s.planetY = GH + PLANET_R * 2 - (GH + PLANET_R * 2 - s.immortalSavedPlanetY) * t;
        const orbitAngle = -PI / 2;
        const targetX = s.planetX + ORBIT_R * cos(orbitAngle);
        const targetY = s.planetY + ORBIT_R * sin(orbitAngle);
        s.immortalShipX = s.immortalDepartX + (targetX - s.immortalDepartX) * t;
        s.immortalShipY = s.immortalDepartY + (targetY - s.immortalDepartY) * t;

        if (elapsed >= RETURN_DUR) {
          s.immortalPhase = null;
          s.immortal = false;
          s.immortalExpire = 0;
          s.planetX = CX;
          s.planetY = s.immortalSavedPlanetY;
          s.planetTargetY = s.immortalSavedPlanetY;
          s.playerAngle = -PI / 2;
          s.shipTargetAngle = -PI / 2;
          s.draggingShip = false;
          s.planetExploded = false;
          s.shieldActive = 0;
          s.shieldHP = 0;
          s.levelComplete = false;
          s.travelBgOffset = 0;
          s.immortalSavedAsteroids = [];
          // Start fresh wave at whatever level we reached
          startWave(s, 1, ts);
          fireQueue.current = [];
          specialQueue.current = [];
        }
      }

      // Particles, debris, score popups during immortal
      for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life -= 0.035; }
      s.particles = s.particles.filter(p => p.life > 0);
      for (const d of s.debris) { d.x += d.vx; d.y += d.vy; d.rotation += d.rotSpeed; d.life -= 0.02; }
      s.debris = s.debris.filter(d => d.life > 0);
      for (const sp of s.scorePopups) { sp.y -= 0.8; sp.life -= 0.02; }
      s.scorePopups = s.scorePopups.filter(sp => sp.life > 0);

      if (!IS_MOBILE || ts - lastRender.current >= RENDER_INTERVAL) {
        lastRender.current = ts;
        setTick((t) => t + 1);
      }
      raf.current = requestAnimationFrame(loop);
      return;
    }

    // Ship-explode timeout
    if (s.shipDestroyed && !s.gameOver && s.shipExplodeTime > 0 && ts - s.shipExplodeTime > 1500) {
      s.gameOver = true;
    }
    // Level banner timeout
    if (s.levelBanner > 0 && ts - s.levelBanner > 4000) s.levelBanner = 0;

    // Player angle â€” move toward next queued fire target
    if (alive && !s.shipDestroyed) {
      if (s.draggingShip) {
        // Dragging: ship follows pointer instantly
        const dx = pointer.current.x - s.planetX;
        const dy = pointer.current.y - s.planetY;
        if (dx !== 0 || dy !== 0) {
          s.playerAngle = atan2(dy, dx);
          s.shipTargetAngle = s.playerAngle;
        }
      } else if (fireQueue.current.length > 0 || specialQueue.current.length > 0) {
        // Drive toward the FIRST queued target (blaster or special)
        const target = fireQueue.current.length > 0
          ? fireQueue.current[0]
          : specialQueue.current[0];
        s.shipTargetAngle = target;
        const speed = 0.04 * (1 + s.upgrades.thrusterLevel);
        let diff = target - s.playerAngle;
        while (diff > PI) diff -= PI2;
        while (diff < -PI) diff += PI2;
        if (abs(diff) < speed) {
          s.playerAngle = target;
        } else {
          s.playerAngle += diff > 0 ? speed : -speed;
        }
      }
    }

    // Fire when ship reaches the front of the queue
    const fireCD = max(30, FIRE_COOLDOWN - max(0, s.upgrades.fireRateLevel - 1) * 15);
    if (alive && !s.shipDestroyed && fireQueue.current.length > 0 && !bumperHeld.current
        && !s.draggingShip && ts - lastFire.current > fireCD) {
      let arrivalDiff = fireQueue.current[0] - s.playerAngle;
      while (arrivalDiff > PI) arrivalDiff -= PI2;
      while (arrivalDiff < -PI) arrivalDiff += PI2;
      if (abs(arrivalDiff) < 0.05) {
        fire();
        lastFire.current = ts;
        fireQueue.current.shift();
      }
    }

    // Fire special when ship reaches the front of the special queue
    if (alive && !s.shipDestroyed && specialQueue.current.length > 0 && !s.draggingShip) {
      const stgt = specialQueue.current[0];
      let sd = stgt - s.playerAngle;
      while (sd > PI) sd -= PI2;
      while (sd < -PI) sd += PI2;
      if (abs(sd) < 0.05) {
        s.playerAngle = stgt;
        fireSpecial();
        specialQueue.current.shift();
      }
    }

    // Plasma charge tick â€” every 600ms absorb one charge while held
    if (s.plasmaCharging && chargeHeld.current && s.plasmaAmmo > 0) {
      const CHARGE_INTERVAL = 600;
      const elapsed = ts - s.plasmaChargeStart;
      const targetCharges = min(min(s.plasmaAmmo, 10), floor(elapsed / CHARGE_INTERVAL));
      if (targetCharges > s.plasmaChargeCount) {
        s.plasmaChargeCount = targetCharges;
      }
      // Cap: stop if max charges reached
      if (s.plasmaChargeCount >= min(s.plasmaAmmo, 10)) {
        // Stay charging but don't go higher
      }
    }

    // Magnet tick â€” capture nearby objects and hold them at collection point
    if (s.magnetActive && magnetHeld.current) {
      const magLvl = s.upgrades.magnetLevel;
      const MAGNET_RANGE = 250 + (magLvl - 1) * 25; // 250 at lvl1, 475 at lvl10
      const COLLECT_DIST = 50;
      const PULL_STRENGTH = 0.04;
      const shipX = s.planetX + ORBIT_R * cos(s.playerAngle);
      const shipY = s.planetY + ORBIT_R * sin(s.playerAngle);
      const collectX = shipX + cos(s.playerAngle) * COLLECT_DIST;
      const collectY = shipY + sin(s.playerAngle) * COLLECT_DIST;
      const MAX_CAPTURED = 12 + (magLvl - 1) * 2; // 12 at lvl1, 30 at lvl10
      const now = performance.now();
      let heldCount = s.magnetProjectiles.filter(mp => mp.held).length;

      // Capture asteroids in range
      if (heldCount < MAX_CAPTURED) {
        const toCapture: typeof s.asteroids = [];
        s.asteroids = s.asteroids.filter((a) => {
          if (a.isBoss) return true;
          const dist = hypot(a.x - shipX, a.y - shipY);
          if (dist < MAGNET_RANGE && heldCount + toCapture.length < MAX_CAPTURED) {
            toCapture.push(a);
            return false;
          }
          return true;
        });
        for (const a of toCapture) {
          s.asteroidsCleared++;
          s.magnetProjectiles.push({
            id: uid(), x: a.x, y: a.y, vx: 0, vy: 0,
            radius: a.radius, sprite: a.sprite, asteroidType: a.asteroidType,
            rotation: a.rotation, rotSpeed: a.rotSpeed,
            hit: new Set(), startTime: now, duration: 99999, held: true,
          });
        }
        heldCount += toCapture.length;
      }

      // Capture fighters in range
      if (heldCount < MAX_CAPTURED) {
        const capF: typeof s.alienFighters = [];
        s.alienFighters = s.alienFighters.filter((f) => {
          const dist = hypot(f.x - shipX, f.y - shipY);
          if (dist < MAGNET_RANGE && heldCount + capF.length < MAX_CAPTURED) {
            capF.push(f);
            return false;
          }
          return true;
        });
        for (const f of capF) {
          s.aliensKilled++;
          s.magnetProjectiles.push({
            id: uid(), x: f.x, y: f.y, vx: 0, vy: 0,
            radius: 18, sprite: 0, asteroidType: 'brown',
            rotation: f.faceAngle, rotSpeed: 3,
            hit: new Set(), startTime: now, duration: 99999,
            enemyType: 'fighter', held: true,
          });
        }
        heldCount += capF.length;
      }

      // Capture drones in range
      if (heldCount < MAX_CAPTURED) {
        const capD: typeof s.alienDrones = [];
        s.alienDrones = s.alienDrones.filter((d) => {
          const dist = hypot(d.x - shipX, d.y - shipY);
          if (dist < MAGNET_RANGE && heldCount + capD.length < MAX_CAPTURED) {
            capD.push(d);
            return false;
          }
          return true;
        });
        for (const d of capD) {
          s.aliensKilled++;
          s.magnetProjectiles.push({
            id: uid(), x: d.x, y: d.y, vx: 0, vy: 0,
            radius: 16, sprite: 0, asteroidType: 'brown',
            rotation: d.rotation, rotSpeed: 3,
            hit: new Set(), startTime: now, duration: 99999,
            enemyType: 'drone', held: true,
          });
        }
      }

      // Pull held projectiles toward collection point
      for (const mp of s.magnetProjectiles) {
        if (!mp.held) continue;
        const toX = collectX - mp.x;
        const toY = collectY - mp.y;
        mp.vx += toX * PULL_STRENGTH;
        mp.vy += toY * PULL_STRENGTH;
        mp.vx *= 0.82;
        mp.vy *= 0.82;
        mp.x += mp.vx;
        mp.y += mp.vy;
        mp.rotation += mp.rotSpeed * 0.02;
      }


    }

    // Timers (skip old expiry when immortal phase is managing it)
    if (s.immortal && !s.immortalPhase && s.immortalExpire > 0 && ts > s.immortalExpire) {
      s.immortal = false;
      s.immortalExpire = 0;
    }
    if (s.shieldActive > 0 && s.shieldHP <= 0) { s.shieldActive = 0; s.shieldHP = 0; }
    s.bumperActive = bumperHeld.current && !s.shipDestroyed && !s.gameOver && !s.won;

    // Smoothly move planet toward target position
    const planetDY = s.planetTargetY - s.planetY;
    if (Math.abs(planetDY) > 0.5) {
      s.planetY += planetDY * 0.04;
    } else {
      s.planetY = s.planetTargetY;
    }

    // Spawning (wave 1 & 2 only; wave 3/4 asteroids are pre-spawned)
    const cfg = getLevelConfig(s.level);
    if (s.wave === 1 || s.wave === 2) {
      const screenCleared = s.asteroidsSpawned > 0 && s.asteroids.every(a => a.isBoss);
      const maxOn = s.wave === 2 ? cfg.maxOnScreen * 3 : cfg.maxOnScreen;
      const batchSize = s.wave === 2 ? 3 : 10;
      const canSpawn = s.wave === 1
        ? s.asteroids.filter(a => !a.isBoss).length < maxOn
        : screenCleared || ts - s.lastSpawn > cfg.spawnDelay;
      if (
        alive && !s.shipDestroyed &&
        s.asteroidsSpawned < s.asteroidsToSpawn &&
        canSpawn
      ) {
        const toSpawn = min(batchSize, s.asteroidsToSpawn - s.asteroidsSpawned);
        for (let i = 0; i < toSpawn; i++) {
          if (s.asteroids.filter(a => !a.isBoss).length >= maxOn) break;
          if (s.wave === 1) {
            s.asteroids.push(mkAsteroid(s.level));
          } else {
            const col = s.asteroidsSpawned % batchSize;
            const slotW = GW / batchSize;
            const slotX = slotW * (col + 0.2 + rand() * 0.6);
            s.asteroids.push(mkRainAsteroid(s.level, s.planetY, slotX));
          }
          s.asteroidsSpawned++;
        }
        s.lastSpawn = ts;
      }
    }

    // Wave 4: spawn bosses once planet has settled
    if (s.wave === 4 && !s.bossSpawned && Math.abs(s.planetY - s.planetTargetY) < 1) {
      s.bossSpawned = true;
      if (s.level === 5) {
        // Mini Boss wave: 4 mini bosses from top
        for (let i = 0; i < 4; i++) {
          s.asteroids.push(mkMiniBoss(s.level, false, i));
        }
      } else if (s.level === 10) {
        // Boss wave: 1 large boss from top + 4 mini bosses from bottom
        s.asteroids.push(mkBoss(s.level));
        for (let i = 0; i < 4; i++) {
          s.asteroids.push(mkMiniBoss(s.level, true, i));
        }
      }
    }

    // Bullet physics + homing
    for (const b of s.bullets) {
      if (b.homing > 0) {
        // Find nearest asteroid/alien
        let nearDist = 999999, nearX = 0, nearY = 0, found = false;
        for (const a of s.asteroids) {
          const d = hypot(a.x - b.x, a.y - b.y);
          if (d < nearDist) { nearDist = d; nearX = a.x; nearY = a.y; found = true; }
        }
        for (const f of s.alienFighters) {
          const d = hypot(f.x - b.x, f.y - b.y);
          if (d < nearDist) { nearDist = d; nearX = f.x; nearY = f.y; found = true; }
        }
        for (const dr of s.alienDrones) {
          const d = hypot(dr.x - b.x, dr.y - b.y);
          if (d < nearDist) { nearDist = d; nearX = dr.x; nearY = dr.y; found = true; }
        }
        if (found && nearDist < 300) {
          const toAngle = atan2(nearY - b.y, nearX - b.x);
          const curAngle = atan2(b.vy, b.vx);
          let diff = toAngle - curAngle;
          while (diff > PI) diff -= PI2;
          while (diff < -PI) diff += PI2;
          const turn = diff * b.homing;
          const spd = hypot(b.vx, b.vy);
          const newAngle = curAngle + turn;
          b.vx = cos(newAngle) * spd;
          b.vy = sin(newAngle) * spd;
        }
      }
      b.x += b.vx; b.y += b.vy;
    }

    // Collect OOB bullet volley IDs
    const oobVolleys = new Set<number>();
    for (const b of s.bullets) {
      if (b.x <= -OOB || b.x >= GW + OOB || b.y <= -OOB || b.y >= GH + OOB) {
        oobVolleys.add(b.volley);
      }
    }

    s.bullets = s.bullets.filter(
      (b) => b.x > -OOB && b.x < GW + OOB && b.y > -OOB && b.y < GH + OOB,
    );

    // Miss = a volley where ALL bullets went OOB and none hit anything
    if (oobVolleys.size > 0) {
      const aliveVolleys = new Set<number>();
      for (const b of s.bullets) aliveVolleys.add(b.volley);
      for (const v of oobVolleys) {
        if (!aliveVolleys.has(v)) {
          // Volley is fully gone â€” reset if none of its bullets ever hit
          if (!s.hitVolleys.has(v)) resetMultiplier(s);
          s.hitVolleys.delete(v);
        }
      }
    }

    // Wave physics
    for (const w of s.waves) w.radius += WAVE_SPEED;
    s.waves = s.waves.filter((w) => w.radius < WAVE_MAX_R);

    // â”€â”€ System updates (logic in each component file) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    updateAsteroids(s, ts);
    updatePowerUps(s, ts);
    updateShip(s, ts);
    updatePlanet(s, ts);
    if (isMercuryLevel(s.level)) {
      updateAlienFighters(s, ts);
      updateAlienDiscs(s, ts);
      updateAlienDrones(s, ts);
      updateBossAlien(s, ts);
    }

    // Particle physics
    for (const p of s.particles) { p.x += p.vx; p.y += p.vy; p.life -= 0.035; }
    s.particles = s.particles.filter((p) => p.life > 0);
    if (s.particles.length > 300) s.particles = s.particles.slice(-300);

    // Debris physics
    for (const d of s.debris) { d.x += d.vx; d.y += d.vy; d.rotation += d.rotSpeed; d.life -= 0.02; }
    s.debris = s.debris.filter((d) => d.life > 0);
    if (s.debris.length > 100) s.debris = s.debris.slice(-100);

    // Score popup physics
    for (const sp of s.scorePopups) { sp.y -= 0.8; sp.life -= 0.02; }
    s.scorePopups = s.scorePopups.filter(sp => sp.life > 0);

    updateSatellites(s, ts, alive);

    // Wave / Level completion
    const levelCfg = getLevelConfig(s.level);
    const mercuryLvl = isMercuryLevel(s.level);
    const nonBossAsteroids = s.asteroids.filter(a => !a.isBoss);
    const allBossesDead = s.wave === 4 && s.bossSpawned && s.asteroids.filter(a => a.isBoss).length === 0;
    const bossDead = mercuryLvl && s.level === 30 && s.bossDefeated
                   && s.bossDefeatTime > 0 && (ts - s.bossDefeatTime >= 3000);
    const aliensDone = mercuryLvl && s.aliensKilled >= s.aliensToKill && s.aliensToKill > 0
                     && s.alienFighters.length === 0 && s.alienDiscs.length === 0 && s.alienDrones.length === 0;
    const waveDone = (s.wave === 4 && bossDead)
      ? true
      : mercuryLvl
      ? aliensDone
      : s.wave === 3
        ? s.spiralReady && nonBossAsteroids.length === 0
        : s.wave === 4
          ? allBossesDead
          : s.asteroidsCleared >= s.asteroidsToSpawn && nonBossAsteroids.length === 0;

    if (alive && !s.shipDestroyed && !s.levelComplete && waveDone) {
      const hasWave4 = s.level === 5 || s.level === 10 || s.level === 30;
      const maxWaveForLevel = mercuryLvl ? (s.level === 30 ? 4 : 3) : (hasWave4 ? 4 : 3);
      if (s.wave < maxWaveForLevel) {
        // Clear leftover rain asteroids from Mercury wave 2
        if (mercuryLvl && s.wave === 2) {
          s.asteroids = s.asteroids.filter(a => !a.isRain);
          s.alienDiscs = [];
          s.discShockwaves = [];
          s.planetTargetY = CY;
        }
        // Advance to next wave
        const nextWave = (s.wave + 1) as 1 | 2 | 3 | 4;
        startWave(s, nextWave, ts);
      } else if (s.wave === 3 && hasWave4) {
        // Wave 3 done on level 5 or 10 â†’ go to wave 4 (boss wave)
        startWave(s, 4, ts);
      } else if (s.wave === 4) {
        // Wave 4 done â†’ move planet back to center, then complete level
        s.asteroids = s.asteroids.filter((a) => !a.isBoss);
        s.alienBoss = null;
        s.bossDiscs = [];
        s.planetTargetY = CY;
        if (Math.abs(s.planetY - CY) < 1) {
          const modeEnd = s.modeConfig ? s.modeConfig.endLevel : MAX_LEVEL;
          if (modeEnd > 0 && s.level >= modeEnd) {
            s.won = true;
          } else if (s.level % 10 === 0) {
            // Checkpoint reached
            if (s.modeConfig) s.checkpointLevel = s.level;
            recordCheckpoint(s.level);
            recordBossDefeat(s.level);
            // Start travel phase to the next planet
            s.levelComplete = true;
            s.travelPhase = 'departing';
            s.travelStart = ts;
            s.levelBanner = ts;
            const sx = s.planetX + ORBIT_R * cos(s.playerAngle);
            const sy = s.planetY + ORBIT_R * sin(s.playerAngle);
            s.travelShipX = sx;
            s.travelShipY = sy;
            s.travelDepartX = sx;
            s.travelDepartY = sy;
            s.travelDepartRot = s.playerAngle + PI / 2;
            s.travelBgOffset = 0;
            s.travelAsteroids = [];
          } else {
            s.upgradePoints++;
            s.levelComplete = true;
            startLevel(s, s.level + 1, ts);
          }
        }
      } else {
        // Wave 3 done (no wave 4) â†’ check boss or complete level
        const bossBlocking = !mercuryLvl && levelCfg.boss
          ? !(s.bossDefeated && s.bossDefeatTime > 0 && (ts - s.bossDefeatTime >= 3000))
          : false;

        if (!bossBlocking) {
          if (levelCfg.boss) s.asteroids = s.asteroids.filter((a) => !a.isBoss);
          const modeEnd2 = s.modeConfig ? s.modeConfig.endLevel : MAX_LEVEL;
          if (modeEnd2 > 0 && s.level >= modeEnd2) {
            s.won = true;
          } else if (s.level % 10 === 0) {
            // Checkpoint reached
            if (s.modeConfig) s.checkpointLevel = s.level;
            recordCheckpoint(s.level);
            recordBossDefeat(s.level);
            // Start travel phase to the next planet
            s.levelComplete = true;
            s.travelPhase = 'departing';
            s.travelStart = ts;
            s.levelBanner = ts;
            const sx = s.planetX + ORBIT_R * cos(s.playerAngle);
            const sy = s.planetY + ORBIT_R * sin(s.playerAngle);
            s.travelShipX = sx;
            s.travelShipY = sy;
            s.travelDepartX = sx;
            s.travelDepartY = sy;
            s.travelDepartRot = s.playerAngle + PI / 2;
            s.travelBgOffset = 0;
            s.travelAsteroids = [];
          } else {
            s.upgradePoints++;
            s.levelComplete = true;
            startLevel(s, s.level + 1, ts);
          }
        }
      }
    }

    // Throttle renders on mobile (~30fps) while keeping physics at 60fps
    if (!IS_MOBILE || ts - lastRender.current >= RENDER_INTERVAL) {
      lastRender.current = ts;
      setTick((t) => t + 1);
    }

    // Fire backend level-complete when level advances
    const sid = sessionIdRef.current;
    if (sid != null && s.level > lastSyncedLevel.current && s.levelComplete) {
      const lvl = s.level;
      const sc = s.score;
      const kills = { ...s.killCounts };
      lastSyncedLevel.current = lvl;
      GameService.levelComplete(sid, lvl, sc, kills).catch(() => {});
    }

    // Fire backend submit-score on game over (once)
    if (sid != null && s.gameOver && lastSyncedLevel.current > 0) {
      const sc = s.score;
      const lvl = s.level;
      const kills = { ...s.killCounts };
      lastSyncedLevel.current = 0; // prevent duplicate submission
      GameService.submitScore(sid, sc, lvl, kills).catch(() => {});
    }

    raf.current = requestAnimationFrame(loop);
  }, [fire]);

  // â”€â”€â”€ Start / cleanup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  useEffect(() => {
    if (!ready) return;
    resetUid();
    gs.current = initState(performance.now());
    raf.current = requestAnimationFrame(loop);
    GameService.getGameConfig().then(applyServerConfig).catch(() => {});
    GameService.startNewGame().then((sess) => {
      sessionIdRef.current = sess.sessionId;
    }).catch(() => {});
    return () => cancelAnimationFrame(raf.current);
  }, [loop, ready]);

  // â”€â”€â”€ Restart â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  const restart = useCallback(() => {
    cancelAnimationFrame(raf.current);
    resetUid();
    fireQueue.current = [];
    specialQueue.current = [];
    lastSyncedLevel.current = 1;
    const mode = gs.current.modeConfig;
    // Arcade: restart from last checkpoint; others: full restart
    if (mode && mode.mode === 'arcade' && gs.current.checkpointLevel > 0) {
      const now = performance.now();
      gs.current = initState(now, { ...mode, startLevel: gs.current.checkpointLevel + 1 });
      startLevel(gs.current, gs.current.checkpointLevel + 1, now);
    } else {
      gs.current = initState(performance.now(), mode ?? undefined);
    }
    raf.current = requestAnimationFrame(loop);
    GameService.startNewGame().then((sess) => {
      sessionIdRef.current = sess.sessionId;
    }).catch(() => {});
  }, [loop]);

  // â”€â”€â”€ Render (Skia Canvas) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  // Show loading screen until critical images are ready
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 18 }}>Loading assetsâ€¦</Text>
      </View>
    );
  }

  const s = gs.current;
  const ts = performance.now();
  const flashOpacity = s.planetFlash > 0 ? max(0, 1 - (ts - s.planetFlash) / 400) : 0;
  const bannerFadeDur = s.immortalPhase ? 1200 : 4000;
  const bannerOpacity = s.levelBanner > 0 ? max(0, 1 - (ts - s.levelBanner) / bannerFadeDur) : 0;
  const pa = s.playerAngle;
  const ex = s.planetX;
  const ey = s.planetY;
  const inImmortalRender = !!s.immortalPhase;
  const inTravelRender = !!s.travelPhase;
  const px = inImmortalRender ? s.immortalShipX : inTravelRender ? s.travelShipX : ex + ORBIT_R * cos(pa);
  const py = inImmortalRender ? s.immortalShipY : inTravelRender ? s.travelShipY : ey + ORBIT_R * sin(pa);

  const onTouchStart = (e: any) => {
    const t = e.nativeEvent;
    const tx = t.pageX - OX;
    const ty = t.pageY - OY;
    pointer.current = { x: tx, y: ty };
    const s = gs.current;
    // Travel / immortal phase: drag only, no firing
    if (s.travelPhase || s.immortalPhase === 'active') {
      s.draggingShip = true;
      return;
    }
    // Queue this tap angle â€” ship will visit each in order
    const dx = tx - s.planetX;
    const dy = ty - s.planetY;
    if (dx !== 0 || dy !== 0) fireQueue.current.push(atan2(dy, dx));
    // satellite purchase moved to upgrade menu
  };
  const onTouchMove = (e: any) => {
    const t = e.nativeEvent;
    pointer.current = { x: t.pageX - OX, y: t.pageY - OY };
  };
  const onTouchEnd = () => { gs.current.draggingShip = false; };



  return (
    <View
      style={{ flex: 1, backgroundColor: "#000" }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      <StatusBar hidden />
      <View style={{ position: "absolute", left: OX, top: OY, width: GW, height: GH, overflow: "hidden" }}>
        <Canvas style={{ width: GW, height: GH }}>
          <Background imgBg={imgBg} s={s} ts={ts} />
          <Group opacity={s.upgradeMenuOpen || s.showColorMenu ? 0 : 1}>
            <PlanetRenderer s={s} ts={ts} ex={ex} ey={ey} flashOpacity={flashOpacity}
              planetImageMap={planetImageMap} imgEarth={imgEarth} imgEarthGold={imgEarthGold} />
            <SatelliteRenderer s={s} ts={ts} ex={ex} ey={ey}
              imgSatellite={imgSatellite} imgSatGold={imgSatGold} imgPhotonBlue={imgPhotonBlue} />
            <ParticlesRenderer s={s} ts={ts} imgDebris={imgDebris} imgPower={imgPower}
              astImgMap={astImgMap} imgBrownAst={imgBrownAst} />
            <AsteroidRenderer s={s} ts={ts} astImgMap={astImgMap} imgBrownAst={imgBrownAst} imgBoss={imgBoss} />
            <AlienRenderer s={s} ts={ts} px={px} py={py} pa={pa}
              imgAlienBlue={imgAlienBlue} imgAlienRed={imgAlienRed} imgAlienDisc={imgAlienDisc}
              imgDroneBlue={imgDroneBlue} imgDroneRed={imgDroneRed} />
            <BossAlienRenderer s={s} ts={ts} px={px} py={py} pa={pa}
              imgBossAlien={imgBossAlien} imgBossAlienAwake={imgBossAlienAwake}
              imgBossAlienRed={imgBossAlienRed} imgBossAlienRedAwake={imgBossAlienRedAwake}
              imgAlienDisc={imgAlienDisc} />
            <WeaponEffects s={s} ts={ts} px={px} py={py} pa={pa}
              imgPhotonBlue={imgPhotonBlue} imgWaveArc={imgWaveArc} imgAlienDisc={imgAlienDisc}
              imgAlienBlue={imgAlienBlue} imgDroneBlue={imgDroneBlue}
              astImgMap={astImgMap} imgBrownAst={imgBrownAst} />
            <PlayerRenderer s={s} ts={ts} px={px} py={py} pa={pa}
              shipImgs={shipImgs} imgShipGold={imgShipGold} />
            <ShieldRenderer s={s} ts={ts} px={px} py={py} pa={pa} />
            <BossHealthBar s={s} />
          </Group>
        </Canvas>

        {/* HUD stays as React Native Views (simple text/icons, only updates occasionally) */}
        {!s.upgradeMenuOpen && !s.showColorMenu && (
        <HUD
          score={s.score}
          level={s.level}
          wave={s.wave}
          shieldActive={s.shieldActive}
          immortal={s.immortal}
          planetShield={s.planetShield}
          missileCount={s.missileCount}
          waveAmmo={s.waveAmmo}
          plasmaAmmo={s.plasmaAmmo}
          plasmaCharging={s.plasmaCharging}
          plasmaChargeCount={s.plasmaChargeCount}
          crossLaserAmmo={s.crossLaserAmmo}
          chainLightningAmmo={s.chainLightningAmmo}
          discLauncherAmmo={s.discLauncherAmmo}
          magnetAmmo={s.magnetAmmo}
          magnetActive={s.magnetActive}
          magnetCapturedCount={s.magnetProjectiles.filter(mp => mp.held).length}
          selectedWeapon={s.selectedWeapon}
          forceFieldHP={s.forceFieldHP}
          forceFieldMaxHP={s.forceFieldMaxHP}
          laserColor={s.laserColor}
          bannerOpacity={bannerOpacity}
          levelBannerTime={s.levelBanner}
          travelPhase={s.travelPhase}
          immortalPhase={s.immortalPhase}
          immortalWave={s.immortalWave}
          startTime={s.startTime}
          ts={ts}
          multiplier={s.multiplier}
          timed={!!s.modeConfig?.timed}
          elapsedMs={s.elapsedMs}
          onFireSpecial={fireSpecial}
          onCycleWeapon={() => {
            const s2 = gs.current;
            const owned = (['nuke', 'wave', 'plasma', 'cross', 'chain', 'disc', 'magnet'] as SpecialWeapon[]).filter(w =>
              (w === 'nuke' && s2.missileCount > 0) || (w === 'wave' && s2.waveAmmo > 0) ||
              (w === 'plasma' && s2.plasmaAmmo > 0) || (w === 'cross' && s2.crossLaserAmmo > 0) ||
              (w === 'chain' && s2.chainLightningAmmo > 0) || (w === 'disc' && s2.discLauncherAmmo > 0) ||
              (w === 'magnet' && (s2.magnetAmmo > 0 || s2.magnetActive))
            );
            if (owned.length === 0) return;
            const idx = owned.indexOf(s2.selectedWeapon);
            const next = Math.min(owned.length - 1, idx + 1);
            s2.selectedWeapon = owned[next];
          }}
        />
        )}

        <ScorePopups scorePopups={s.scorePopups} />
      </View>

      <GameOverlay
        visible={s.gameOver}
        score={s.score}
        level={s.level}
        isBonus={!!s.travelPhase}
        laserColor={s.laserColor}
        permadeath={s.modeConfig?.permadeath}
        onRestart={restart}
        onMainMenu={() => router.replace("/")}
      />

      <SelectionOverlay
        visible={s.showColorMenu}
        shipColor={s.shipColor}
        laserColor={s.laserColor}
        unlockedPlasma={s.unlockedPlasma}
        onSetShipColor={(c) => {
          gs.current.shipColor = c as any;
          const sid = sessionIdRef.current;
          if (sid != null) GameService.setShipColor(sid, c).catch(() => {});
        }}
        onSetLaserColor={(c) => {
          gs.current.laserColor = c;
          const sid = sessionIdRef.current;
          if (sid != null) GameService.setLaserColor(sid, c).catch(() => {});
        }}
        onContinue={() => {
          const sc = gs.current;
          sc.showColorMenu = false;
          startLevel(sc, sc.level + 1, performance.now());
        }}
      />

      {s.upgradeMenuOpen && (
        <UpgradeOverlay
          upgrades={s.upgrades}
          score={s.score}
          level={s.level}
          shipColor={s.shipColor}
          laserColor={s.laserColor}
          unlockedSkins={s.unlockedSkins}
          unlockedPlasma={s.unlockedPlasma}
          satelliteCount={s.satellites.length}
          onBuyTech={(key: keyof Upgrades) => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.buyTech(sid, key).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              const cost = gameConfig.buyCosts[key] ?? 0;
              if (sc.upgrades[key] >= 1 || sc.score < cost) return;
              sc.upgrades[key] = 1;
              sc.score -= cost;
            }
          }}
          onSellTech={(key: keyof Upgrades) => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.sellTech(sid, key).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              const lvl = sc.upgrades[key];
              if (lvl < 1) return;
              let refund = Math.floor((gameConfig.buyCosts[key] ?? 0) / 2);
              for (let l = 2; l <= lvl; l++) refund += getSellValue(l);
              sc.upgrades[key] = 0;
              sc.score += refund;
            }
          }}
          onUpgrade={(key: keyof Upgrades) => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.upgradeLevelUp(sid, key).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              const cost = getUpgradeCost(sc.upgrades[key]);
              if (sc.upgrades[key] >= gameConfig.maxUpgradeLevel || sc.score < cost) return;
              sc.upgrades[key]++;
              sc.score -= cost;
            }
          }}
          onSell={(key: keyof Upgrades) => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.upgradeLevelDown(sid, key).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              if (sc.upgrades[key] < 2) return;
              const refund = getSellValue(sc.upgrades[key]);
              sc.upgrades[key]--;
              sc.score += refund;
            }
          }}
          onSellSatellite={() => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.sellSatellite(sid).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              if (sc.satellites.length < 1) return;
              sc.satellites.pop();
              sc.score += gameConfig.satelliteSell;
            }
          }}
          onSetShipColor={(c) => {
            gs.current.shipColor = c;
            const sid = sessionIdRef.current;
            if (sid != null) GameService.setShipColor(sid, c).catch(() => {});
          }}
          onBuySkin={(c) => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.buySkin(sid, c).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              const cost = gameConfig.skinCosts[c] ?? 0;
              if (sc.unlockedSkins.has(c) || sc.score < cost) return;
              sc.unlockedSkins.add(c);
              sc.score -= cost;
              sc.shipColor = c;
            }
          }}
          onSetLaserColor={(c) => {
            gs.current.laserColor = c;
            const sid = sessionIdRef.current;
            if (sid != null) GameService.setLaserColor(sid, c).catch(() => {});
          }}
          onBuyPlasma={(c) => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.buyPlasma(sid, c).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              if (sc.unlockedPlasma.has(c) || sc.score < gameConfig.plasmaCost) return;
              sc.unlockedPlasma.add(c);
              sc.score -= gameConfig.plasmaCost;
              sc.laserColor = c;
            }
          }}
          onBuySatellite={() => {
            const sid = sessionIdRef.current;
            if (sid != null) {
              GameService.buySatellite(sid).then(applySession).catch(() => {});
            } else {
              const sc = gs.current;
              if (sc.satellites.length >= gameConfig.maxSatellites || sc.score < gameConfig.satelliteCost) return;
              sc.score -= gameConfig.satelliteCost;
              sc.satellites.push({
                id: uid(), angle: sc.playerAngle + PI,
                targetAngle: sc.playerAngle + PI, lastFire: 0, shieldActive: false,
              });
            }
          }}
          onLevels={() => {
            // TODO: Level select not yet implemented
          }}
          onClose={() => {
            const sc = gs.current;
            sc.upgradeMenuOpen = false;
            sc.paused = false;
          }}
        />
      )}
    </View>
  );
}
