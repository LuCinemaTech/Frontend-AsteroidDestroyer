import React from "react";
import { View, Image } from "react-native";
import type { GameState, Asteroid } from "../_shared/types";
import {
  GW, GH, ORBIT_R, BULLET_R,
  SAT_FIRE_COOLDOWN, SAT_BULLET_SPEED, SAT_AIM_SPEED, SAT_AIM_TOLERANCE,
  SATELLITE_IMAGE, SATELLITE_GOLD_IMAGE, PHOTON_BLASTER_IMAGES, PLASMA_COLORS, OOB,
  ALIEN_RADIUS, DRONE_RADIUS, DISC_RADIUS, BOSS_ALIEN_RADIUS,
  EXPLOSION_COLORS,
} from "../_shared/constants";
import { gameConfig } from "../_shared/gameConfig";
import {
  uid, hypot, cos, sin, atan2, rand, PI, PI2, floor, max, round,
  spawnAsteroidDebris, mkPowerUpAt, bossDamage, spawnBossDebris,
  spawnMetalDebris, getAsteroidPoints, addScorePopup, advanceMultiplier,
} from "../_shared/helpers";

// ── Satellite logic (AI, fire, satBullet collisions, satellite destruction) ──

export function updateSatellites(s: GameState, ts: number, alive: boolean): void {
  const MIN_SAT_GAP = 0.35;
  const claimedTargets = new Set<string>();
  const assignedTargets: number[] = [];

  for (const sat of s.satellites) {
    // Build a unified target list from ALL enemy types
    let nearX = 0, nearY = 0, nearDist = Infinity;
    let foundKey = '';

    // Regular + boss asteroids
    for (const a of s.asteroids) {
      if (a.radius <= 0) continue;
      if (a.x < -10 || a.x > GW + 10 || a.y < -10 || a.y > GH + 10) continue;
      const key = `a${a.id}`;
      if (claimedTargets.has(key)) continue;
      const d = hypot(a.x - s.planetX, a.y - s.planetY);
      if (d < nearDist) { nearDist = d; nearX = a.x; nearY = a.y; foundKey = key; }
    }
    // Alien fighters
    for (const f of s.alienFighters) {
      if (f.hp <= 0) continue;
      const key = `f${f.id}`;
      if (claimedTargets.has(key)) continue;
      const d = hypot(f.x - s.planetX, f.y - s.planetY);
      if (d < nearDist) { nearDist = d; nearX = f.x; nearY = f.y; foundKey = key; }
    }
    // Alien drones
    for (const dr of s.alienDrones) {
      if (dr.hp <= 0) continue;
      const key = `d${dr.id}`;
      if (claimedTargets.has(key)) continue;
      const d = hypot(dr.x - s.planetX, dr.y - s.planetY);
      if (d < nearDist) { nearDist = d; nearX = dr.x; nearY = dr.y; foundKey = key; }
    }
    // Alien discs
    for (const dc of s.alienDiscs) {
      if (dc.hp <= 0) continue;
      const key = `dc${dc.id}`;
      if (claimedTargets.has(key)) continue;
      const d = hypot(dc.x - s.planetX, dc.y - s.planetY);
      if (d < nearDist) { nearDist = d; nearX = dc.x; nearY = dc.y; foundKey = key; }
    }
    // Boss discs
    for (const bd of s.bossDiscs) {
      if (bd.hp <= 0) continue;
      const key = `bd${bd.id}`;
      if (claimedTargets.has(key)) continue;
      const d = hypot(bd.x - s.planetX, bd.y - s.planetY);
      if (d < nearDist) { nearDist = d; nearX = bd.x; nearY = bd.y; foundKey = key; }
    }
    // Alien boss
    if (s.alienBoss && s.alienBoss.hp > 0 && s.alienBoss.state !== 'dead') {
      const key = `boss`;
      if (!claimedTargets.has(key)) {
        const d = hypot(s.alienBoss.x - s.planetX, s.alienBoss.y - s.planetY);
        if (d < nearDist) { nearDist = d; nearX = s.alienBoss.x; nearY = s.alienBoss.y; foundKey = key; }
      }
    }

    const hasTarget = foundKey !== '';
    if (hasTarget) {
      claimedTargets.add(foundKey);
      let tgt = atan2(nearY - s.planetY, nearX - s.planetX);
      for (const otherTgt of assignedTargets) {
        let gap = tgt - otherTgt;
        while (gap > PI) gap -= PI2;
        while (gap < -PI) gap += PI2;
        if (Math.abs(gap) < MIN_SAT_GAP) {
          tgt = otherTgt + (gap >= 0 ? MIN_SAT_GAP : -MIN_SAT_GAP);
        }
      }
      sat.targetAngle = tgt;
    }
    assignedTargets.push(sat.targetAngle);

    let diff = sat.targetAngle - sat.angle;
    while (diff > PI) diff -= PI2;
    while (diff < -PI) diff += PI2;
    if (Math.abs(diff) > SAT_AIM_SPEED) {
      sat.angle += diff > 0 ? SAT_AIM_SPEED : -SAT_AIM_SPEED;
    } else {
      sat.angle = sat.targetAngle;
    }

    if (alive && !s.shipDestroyed && hasTarget && Math.abs(diff) < SAT_AIM_TOLERANCE && ts - sat.lastFire > SAT_FIRE_COOLDOWN) {
      const sx = s.planetX + cos(sat.angle) * ORBIT_R;
      const sy = s.planetY + sin(sat.angle) * ORBIT_R;
      s.satBullets.push({
        id: uid(),
        x: sx + cos(sat.angle) * 14, y: sy + sin(sat.angle) * 14,
        vx: cos(sat.angle) * SAT_BULLET_SPEED, vy: sin(sat.angle) * SAT_BULLET_SPEED,
      });
      sat.lastFire = ts;
    }
  }

  // SatBullet movement
  for (const sb of s.satBullets) { sb.x += sb.vx; sb.y += sb.vy; }
  s.satBullets = s.satBullets.filter(
    (sb) => sb.x > -OOB && sb.x < GW + OOB && sb.y > -OOB && sb.y < GH + OOB
  );

  // SatBullet ↔ asteroid collisions (regular + boss)
  const onScreen = (a: { x: number; y: number; radius: number }) =>
    a.x + a.radius > 0 && a.x - a.radius < GW &&
    a.y + a.radius > 0 && a.y - a.radius < GH;
  const deadSB = new Set<number>();
  for (const sb of s.satBullets) {
    if (deadSB.has(sb.id)) continue;
    for (const a of s.asteroids) {
      if (deadSB.has(sb.id)) break;
      if (a.radius <= 0 || !onScreen(a)) continue;
      if (hypot(sb.x - a.x, sb.y - a.y) < a.radius + BULLET_R) {
        deadSB.add(sb.id);
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossFlash = ts;
          const result = bossDamage(a, 1);
          if (result === 'dead') {
            const pts = round(gameConfig.bossAsteroidPoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, a.x, a.y, pts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            s.bossDefeatTime = ts;
            for (let i = 0; i < 30; i++) {
              const pa = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa) * pspd, vy: sin(pa) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
            }
            spawnBossDebris(s, a);
            a.radius = -1;
          }
        } else {
          a.hp--;
          if (a.hp <= 0) {
            s.asteroidsCleared++;
            s.destroyedCount++;
            const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
            s.score += pts;
            addScorePopup(s, a.x, a.y, pts);
            s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
            if (a.asteroidType === 'gold') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
            spawnAsteroidDebris(s, a);
            a.radius = -1;
          }
        }
        for (let i = 0; i < 4; i++) {
          const pa = rand() * PI2;
          s.particles.push({ id: uid(), x: sb.x, y: sb.y, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.6, color: '#74b9ff' });
        }
        break;
      }
    }

    // SatBullet ↔ alien fighter collisions
    if (!deadSB.has(sb.id)) {
      for (const af of s.alienFighters) {
        if (af.hp <= 0) continue;
        if (hypot(sb.x - af.x, sb.y - af.y) < ALIEN_RADIUS + BULLET_R) {
          deadSB.add(sb.id);
          af.hp--;
          af.flash = ts;
          advanceMultiplier(s);
          for (let i = 0; i < 3; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: sb.x, y: sb.y, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
          }
          if (af.hp <= 0) {
            const pts = round(gameConfig.alienPoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, af.x, af.y, pts);
            s.killCounts.alien = (s.killCounts.alien || 0) + 1;
            for (let i = 0; i < 20; i++) {
              const pa = rand() * PI2;
              const spd = 1.5 + rand() * 3;
              s.particles.push({ id: uid(), x: af.x, y: af.y, vx: cos(pa) * spd, vy: sin(pa) * spd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
            }
            spawnMetalDebris(s, af.x, af.y, 6);
            s.aliensKilled++;
          }
          break;
        }
      }
    }

    // SatBullet ↔ alien drone collisions
    if (!deadSB.has(sb.id)) {
      for (const dr of s.alienDrones) {
        if (dr.hp <= 0) continue;
        if (hypot(sb.x - dr.x, sb.y - dr.y) < DRONE_RADIUS + BULLET_R) {
          deadSB.add(sb.id);
          dr.hp--;
          dr.flash = ts;
          advanceMultiplier(s);
          for (let i = 0; i < 3; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: sb.x, y: sb.y, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
          }
          if (dr.hp <= 0) {
            const pts = round(gameConfig.dronePoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, dr.x, dr.y, pts);
            s.killCounts.drone = (s.killCounts.drone || 0) + 1;
            for (let i = 0; i < 15; i++) {
              const pa = rand() * PI2;
              const spd = 1.5 + rand() * 3;
              s.particles.push({ id: uid(), x: dr.x, y: dr.y, vx: cos(pa) * spd, vy: sin(pa) * spd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
            }
            spawnMetalDebris(s, dr.x, dr.y, 5);
            s.aliensKilled++;
          }
          break;
        }
      }
    }

    // SatBullet ↔ alien disc collisions
    if (!deadSB.has(sb.id)) {
      for (const dc of s.alienDiscs) {
        if (dc.hp <= 0 || dc.growEnd) continue;
        if (hypot(sb.x - dc.x, sb.y - dc.y) < DISC_RADIUS + BULLET_R) {
          deadSB.add(sb.id);
          dc.hp--;
          dc.flash = ts;
          advanceMultiplier(s);
          for (let i = 0; i < 3; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: sb.x, y: sb.y, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
          }
          if (dc.hp <= 0) {
            const pts = round(gameConfig.discPoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, dc.x, dc.y, pts);
            s.killCounts.disc = (s.killCounts.disc || 0) + 1;
            for (let i = 0; i < 12; i++) {
              const pa = rand() * PI2;
              const spd = 1 + rand() * 2;
              s.particles.push({ id: uid(), x: dc.x, y: dc.y, vx: cos(pa) * spd, vy: sin(pa) * spd, life: 0.6, color: ['#ff4444', '#ff6b6b', '#e74c3c', '#ff8888', '#cc0000'][floor(rand() * 5)] });
            }
          }
          break;
        }
      }
    }

    // SatBullet ↔ boss disc collisions
    if (!deadSB.has(sb.id)) {
      for (const bd of s.bossDiscs) {
        if (bd.hp <= 0) continue;
        if (hypot(sb.x - bd.x, sb.y - bd.y) < DISC_RADIUS + BULLET_R) {
          deadSB.add(sb.id);
          bd.hp--;
          bd.flash = ts;
          advanceMultiplier(s);
          for (let i = 0; i < 3; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: sb.x, y: sb.y, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
          }
          if (bd.hp <= 0) {
            const pts = round(gameConfig.discPoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, bd.x, bd.y, pts);
            s.killCounts.disc = (s.killCounts.disc || 0) + 1;
            for (let i = 0; i < 10; i++) {
              const pa = rand() * PI2;
              const spd = 1 + rand() * 2;
              s.particles.push({ id: uid(), x: bd.x, y: bd.y, vx: cos(pa) * spd, vy: sin(pa) * spd, life: 0.6, color: ['#ff4444', '#ff6b6b', '#e74c3c', '#ff8888', '#cc0000'][floor(rand() * 5)] });
            }
          }
          break;
        }
      }
    }

    // SatBullet ↔ alien boss collision
    if (!deadSB.has(sb.id) && s.alienBoss && s.alienBoss.hp > 0 && s.alienBoss.state !== 'dead') {
      const boss = s.alienBoss;
      if (hypot(sb.x - boss.x, sb.y - boss.y) < BOSS_ALIEN_RADIUS + BULLET_R) {
        deadSB.add(sb.id);
        boss.hp--;
        boss.flash = ts;
        advanceMultiplier(s);
        for (let i = 0; i < 4; i++) {
          const pa = rand() * PI2;
          s.particles.push({ id: uid(), x: sb.x, y: sb.y, vx: cos(pa) * 2.5, vy: sin(pa) * 2.5, life: 0.5, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
        }
        if (boss.hp <= 0) {
          const pts = round(gameConfig.bossAlienPoints * s.multiplier);
          s.score += pts;
          addScorePopup(s, boss.x, boss.y, pts);
          s.killCounts.boss_alien = (s.killCounts.boss_alien || 0) + 1;
          boss.state = 'dead';
          for (let i = 0; i < 40; i++) {
            const pa = rand() * PI2;
            const spd = 2 + rand() * 4;
            s.particles.push({ id: uid(), x: boss.x + (rand() - 0.5) * 40, y: boss.y + (rand() - 0.5) * 40, vx: cos(pa) * spd, vy: sin(pa) * spd, life: 1.5, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
          }
          spawnMetalDebris(s, boss.x, boss.y, 15);
          s.bossDiscs = [];
          s.bossDefeated = true;
          s.bossDefeatTime = ts;
        }
      }
    }
  }
  s.satBullets = s.satBullets.filter(sb => !deadSB.has(sb.id));
  s.asteroids = s.asteroids.filter(a => a.radius > 0);

  // Asteroid ↔ satellite collisions
  const deadSats = new Set<number>();
  for (const sat of s.satellites) {
    const sx = s.planetX + cos(sat.angle) * ORBIT_R;
    const sy = s.planetY + sin(sat.angle) * ORBIT_R;
    const SAT_HIT_R = 12;
    for (const a of s.asteroids) {
      if (hypot(a.x - sx, a.y - sy) < SAT_HIT_R + a.radius) {
        if (sat.shieldActive) {
          sat.shieldActive = false;
          for (let i = 0; i < 5; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: sx, y: sy, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 1, color: '#a29bfe' });
          }
        } else {
          deadSats.add(sat.id);
          for (let i = 0; i < 15; i++) {
            const ea = rand() * PI2;
            const espd = 1.5 + rand() * 3;
            s.particles.push({
              id: uid(), x: sx, y: sy, vx: cos(ea) * espd, vy: sin(ea) * espd, life: 1,
              color: ['#74b9ff', '#a29bfe', '#dfe6e9', '#ffeaa7', '#fff'][floor(rand() * 5)],
            });
          }
          spawnMetalDebris(s, sx, sy, 6);
        }
        break;
      }
    }
  }
  s.satellites = s.satellites.filter(sat => !deadSats.has(sat.id));
}

// ── Satellite render ───────────────────────────────────────────────

interface SatelitesProps {
  satellites: { id: number; angle: number; shieldActive: boolean }[];
  satBullets: { id: number; x: number; y: number; vx: number; vy: number }[];
  immortal: boolean;
  laserColor: string;
}

export default function Satelites({ satellites, satBullets, immortal, laserColor }: SatelitesProps) {
  return (
    <>
      {satellites.map((sat) => {
        const sx = CX + cos(sat.angle) * ORBIT_R;
        const sy = CY + sin(sat.angle) * ORBIT_R;
        const rotDeg = (performance.now() * 0.03) % 360;
        const satImg = immortal ? SATELLITE_GOLD_IMAGE : SATELLITE_IMAGE;
        return (
          <React.Fragment key={sat.id}>
            {sat.shieldActive && (
              <View style={{
                position: "absolute", left: sx - 18, top: sy - 18, width: 36, height: 36,
                borderRadius: 18, borderWidth: 1.5,
                borderColor: `rgba(162,155,254,${(0.4 + Math.sin(performance.now() * 0.005) * 0.25).toFixed(2)})`,
                backgroundColor: "rgba(108,92,231,0.08)",
              }} />
            )}
            <Image
              source={satImg}
              style={{
                position: "absolute", left: sx - 14, top: sy - 14, width: 28, height: 28,
                transform: [{ rotate: `${rotDeg}deg` }],
              }}
              resizeMode="contain"
            />
          </React.Fragment>
        );
      })}

      {satBullets.map((sb) => {
        const sbAngle = Math.atan2(sb.vy, sb.vx) + Math.PI / 2;
        const pc = PLASMA_COLORS[laserColor];
        return (
          <Image
            key={sb.id}
            source={PHOTON_BLASTER_IMAGES.Blue}
            style={{
              position: "absolute", left: sb.x - 10, top: sb.y - 21, width: 20, height: 42,
              opacity: 0.7, transform: [{ rotate: `${sbAngle}rad` }],
              tintColor: pc?.hex,
            }}
            resizeMode="contain"
          />
        );
      })}
    </>
  );
}
