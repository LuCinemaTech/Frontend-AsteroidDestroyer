import React from "react";
import { Image } from "react-native";
import type { GameState } from "../_shared/types";
import { gameConfig } from "../_shared/gameConfig";
import {
  GW, GH, OOB, ORBIT_R, BULLET_R, SPIRAL_ARM_GAP, ASTEROID_MIN_R,
  BROWN_ASTEROID_IMAGES, BLUE_ASTEROID_IMAGES, RED_ASTEROID_IMAGES, CRYSTAL_ASTEROID_IMAGES,
  EXPLOSION_COLORS, DISC_RADIUS,
} from "../_shared/constants";
import {
  uid, hypot, cos, sin, atan2, rand, PI, PI2,
  floor, round, max, min, abs,
  bossDamage, spawnAsteroidDebris, spawnBossDebris, mkPowerUpAt, mkOrbitRings,
  advanceMultiplier, getAsteroidPoints, addScorePopup,
  isMercuryLevel,
} from "../_shared/helpers";

// â”€â”€ Asteroid logic (gravity, movement, ALL collision checks) â”€â”€â”€â”€â”€â”€â”€

export function updateAsteroids(s: GameState, ts: number): void {
  const GRAVITY = 0.001;
  const MAX_ASTEROID_SPD = 1.2;

  const SPIRAL_RATE = 0.15;

  // 1. Gravity + movement
  // Wave 3: asteroids enter as a line from the right, then transition to spiral
  // (Mercury levels use drones instead â€” skip asteroid spiral)
  if (s.wave === 3 && !isMercuryLevel(s.level)) {
    const spiralGap = 100;                           // tighter spiral for wave 3
    const spiralB = spiralGap / (2 * Math.PI);
    const ARC_STEP = s.level <= 10 ? 1.0 : 2.0;    // pixels of arc per frame
    const ENTRY_THETA = 6 * Math.PI;                // entry theta (3 full turns, to the right)
    const entryX = s.planetX + spiralB * ENTRY_THETA; // entry point x

    // Spawn spiral asteroids once planet has returned to center
    if (!s.spiralReady && abs(s.planetY - s.planetTargetY) < 1) {
      s.spiralReady = true;
      const orbitAsteroids = mkOrbitRings(s.level, s.planetX, s.planetY);
      s.asteroids.push(...orbitAsteroids);
      s.asteroidsToSpawn = orbitAsteroids.length;
      s.asteroidsSpawned = orbitAsteroids.length;
    }

    for (const a of s.asteroids) {
      if (!a.isOrbiting || a.orbitAngle === undefined) continue;

      if ((a.spiralLerp ?? 0) < 1) {
        // Phase 1: straight-line entry â€” move left at constant speed
        a.x -= ARC_STEP;
        if (a.x <= entryX) {
          // Reached entry point: lock onto spiral
          a.spiralLerp = 1;
        }
      }

      if ((a.spiralLerp ?? 0) >= 1) {
        // Phase 2: on the spiral â€” advance theta inward
        const theta = a.orbitAngle;
        const dTheta = ARC_STEP / Math.sqrt(spiralB * spiralB * theta * theta + spiralB * spiralB);
        a.orbitAngle -= dTheta;
        const r = spiralB * a.orbitAngle;
        if (r <= 0) {
          a.x = s.planetX; a.y = s.planetY;
        } else {
          a.x = s.planetX + cos(a.orbitAngle) * r;
          a.y = s.planetY + sin(a.orbitAngle) * r;
        }
      }

      a.rotation += a.rotSpeed;
    }
  }
  for (const a of s.asteroids) {
    // Growing asteroids: stay in place until grow finishes, then launch
    if (a.growEnd) {
      if (ts >= a.growEnd) {
        a.vx = a.growVx ?? 0;
        a.vy = a.growVy ?? 0;
        a.growEnd = undefined;
        a.growVx = undefined;
        a.growVy = undefined;
      } else {
        a.rotation += a.rotSpeed;
        continue; // skip movement & gravity while growing
      }
    }
    if (a.isOrbiting) continue;
    if (!a.isBoss) {
      // Gravity steers toward planet but doesn't increase speed
      const prevSpd = hypot(a.vx, a.vy) || 0.1;
      const dx = s.planetX - a.x;
      const dy = s.planetY - a.y;
      const dist = hypot(dx, dy) || 1;
      a.vx += (dx / dist) * GRAVITY;
      a.vy += (dy / dist) * GRAVITY;
      // Re-normalize to original speed so asteroids don't accelerate
      const curSpd = hypot(a.vx, a.vy);
      if (curSpd > 0) {
        a.vx = (a.vx / curSpd) * prevSpd;
        a.vy = (a.vy / curSpd) * prevSpd;
      }
    }
    a.x += a.vx;
    a.y += a.vy;
    a.rotation += a.rotSpeed;
  }

  // 1a. Wave 1: destroy asteroids that left the screen and are heading away
  if (s.wave === 1) {
    for (const a of s.asteroids) {
      if (a.isBoss || a.isOrbiting || a.radius <= 0) continue;
      const outsideX = a.x < -OOB || a.x > GW + OOB;
      const outsideY = a.y < -OOB || a.y > GH + OOB;
      if (!outsideX && !outsideY) continue;
      // Check if velocity points away from game center
      const toCenterX = GW / 2 - a.x;
      const toCenterY = GH / 2 - a.y;
      const dot = a.vx * toCenterX + a.vy * toCenterY;
      if (dot < 0) {
        a.radius = -1;
        s.asteroidsCleared++;
        s.destroyedCount++;
      }
    }
    s.asteroids = s.asteroids.filter(a => a.radius > 0);
  }

  // 1b. Rain asteroids that fall past the bottom of the screen are destroyed
  if (s.wave === 2) {
    for (const a of s.asteroids) {
      if (a.isRain && a.y - a.radius > GH) {
        a.radius = -1;
        s.asteroidsCleared++;
        s.destroyedCount++;
      }
    }
    s.asteroids = s.asteroids.filter(a => a.radius > 0);
  }

  // 1c. Asteroid â†” asteroid collisions (bounce only, no damage)
  for (let i = 0; i < s.asteroids.length; i++) {
    const a = s.asteroids[i];
    if (a.radius <= 0) continue;
    for (let j = i + 1; j < s.asteroids.length; j++) {
      const b = s.asteroids[j];
      if (b.radius <= 0) continue;
      if (a.isOrbiting && b.isOrbiting) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = hypot(dx, dy);
      const minDist = (a.radius + b.radius) * 0.75;
      if (dist >= minDist || dist === 0) continue;

      const nx = dx / dist;
      const ny = dy / dist;

      // Elastic bounce
      const relVx = a.vx - b.vx;
      const relVy = a.vy - b.vy;
      const dot = relVx * nx + relVy * ny;
      if (dot > 0) {
        a.vx -= dot * nx;
        a.vy -= dot * ny;
        b.vx += dot * nx;
        b.vy += dot * ny;
      }
      // Separate overlapping asteroids
      const overlap = minDist - dist;
      a.x -= nx * overlap * 0.5;
      a.y -= ny * overlap * 0.5;
      b.x += nx * overlap * 0.5;
      b.y += ny * overlap * 0.5;
    }
  }

  // Helper: asteroid is on screen (any part visible)
  const onScreen = (a: { x: number; y: number; radius: number }) =>
    a.x + a.radius > 0 && a.x - a.radius < GW &&
    a.y + a.radius > 0 && a.y - a.radius < GH;

  // 2. Bullet â†” asteroid collisions
  const deadB = new Set<number>();
  for (const b of s.bullets) {
    for (const a of s.asteroids) {
      if (a.radius <= 0 || !onScreen(a)) continue;
      if (hypot(b.x - a.x, b.y - a.y) < a.radius + BULLET_R) {
        deadB.add(b.id);
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossFlash = ts;
          const result = bossDamage(a, 1);
          if (result === 'dead') {
            const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
            s.score += bossPts;
            addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            s.bossDefeatTime = ts;
            for (let i = 0; i < 30; i++) {
              const pa = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: cos(pa) * pspd, vy: sin(pa) * pspd,
                life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnBossDebris(s, a);
            // Destroy all remaining non-boss asteroids (not in wave 4)
            if (s.wave !== 4) {
              for (const other of s.asteroids) {
                if (other.id !== a.id && other.radius > 0) {
                  for (let i = 0; i < 6; i++) {
                    const pa2 = rand() * PI2;
                    s.particles.push({ id: uid(), x: other.x, y: other.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.6, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
                  }
                  spawnAsteroidDebris(s, other);
                  other.radius = -1;
                }
              }
            }
            a.radius = -1;
          }
          for (let i = 0; i < 3; i++) {
            const pa = rand() * PI2;
            s.particles.push({
              id: uid(), x: b.x, y: b.y,
              vx: cos(pa) * 2, vy: sin(pa) * 2,
              life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
            });
          }
        } else {
          a.hp--;
          if (a.hp <= 0) {
            s.asteroidsCleared++;
            s.destroyedCount++;
            s.hitVolleys.add(b.volley);
            advanceMultiplier(s);
            const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
            s.score += pts;
            addScorePopup(s, a.x, a.y, pts);
            s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
            if (a.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
            spawnAsteroidDebris(s, a);
            a.radius = -1;
          }
          for (let i = 0; i < 6; i++) {
            const pa = rand() * PI2;
            s.particles.push({
              id: uid(), x: b.x, y: b.y,
              vx: cos(pa) * 2, vy: sin(pa) * 2,
              life: 0.5, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
            });
          }
        }
        break;
      }
    }
  }
  s.bullets = s.bullets.filter((b) => !deadB.has(b.id));
  s.asteroids = s.asteroids.filter((a) => a.radius > 0);

  // 3. Wave â†” asteroid collisions
  for (const w of s.waves) {
    s.asteroids = s.asteroids.filter((a) => {
      if (!onScreen(a)) return true;
      const dx = a.x - w.x;
      const dy = a.y - w.y;
      const dist = hypot(dx, dy);
      if (
        dist < w.radius + a.radius &&
        dist > w.radius - a.radius * 2 &&
        !w.hit.has(a.id)
      ) {
        const angleToA = atan2(dy, dx);
        let angleDiff = angleToA - w.angle;
        while (angleDiff > PI) angleDiff -= PI2;
        while (angleDiff < -PI) angleDiff += PI2;
        // Extend arc by asteroid angular size so edge hits count
        const angularR = dist > 0 ? atan2(a.radius, dist) : PI;
        if (abs(angleDiff) < w.arcWidth / 2 + angularR) {
          w.hit.add(a.id);
          if (a.isBoss && a.bossHP !== undefined) {
            a.bossFlash = ts;
            const result = bossDamage(a, 3);
            if (result === 'dead') {
              const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
              s.score += bossPts;
              addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
              s.bossDefeated = true;
              s.bossDefeatTime = ts;
              for (let i = 0; i < 30; i++) {
                const pa = rand() * PI2;
                const pspd = 2 + rand() * 4;
                s.particles.push({
                  id: uid(), x: a.x, y: a.y,
                  vx: cos(pa) * pspd, vy: sin(pa) * pspd,
                  life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
                });
              }
              spawnBossDebris(s, a);
              // Destroy all remaining non-boss asteroids (not in wave 4)
              if (s.wave !== 4) {
                for (const other of s.asteroids) {
                  if (other.id !== a.id && other.radius > 0) {
                    for (let i = 0; i < 6; i++) {
                      const pa2 = rand() * PI2;
                      s.particles.push({ id: uid(), x: other.x, y: other.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.6, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
                    }
                    spawnAsteroidDebris(s, other);
                    other.radius = -1;
                  }
                }
              }
              return false;
            }
            for (let i = 0; i < 5; i++) {
              const pa = rand() * PI2;
              s.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: cos(pa) * 2, vy: sin(pa) * 2,
                life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            return true;
          } else {
            s.asteroidsCleared++;
            s.destroyedCount++;
            const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
            s.score += pts;
            addScorePopup(s, a.x, a.y, pts);
            s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
            if (a.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
            for (let i = 0; i < 6; i++) {
              const pa = rand() * PI2;
              s.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: cos(pa) * 2.5, vy: sin(pa) * 2.5,
                life: 0.6, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnAsteroidDebris(s, a);
            return false;
          }
        }
      }
      return true;
    });
  }

  // 4. Planet shield â†” asteroid
  if (s.planetShield) {
    s.asteroids = s.asteroids.filter((a) => {
      if (a.isBoss || !onScreen(a)) return true;
      const dist = hypot(a.x - s.planetX, a.y - s.planetY);
      if (dist < ORBIT_R + 8 + a.radius && dist > ORBIT_R - 8 - a.radius) {
        s.asteroidsCleared++;
        s.destroyedCount++;
        const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
        s.score += pts;
        addScorePopup(s, a.x, a.y, pts);
            s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
        if (a.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
        for (let i = 0; i < 6; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: a.x, y: a.y,
            vx: cos(pa) * 2, vy: sin(pa) * 2,
            life: 0.5, color: "#74b9ff",
          });
        }
        spawnAsteroidDebris(s, a);
        return false;
      }
      return true;
    });
  }

  // 5. Plasma pulse â†” asteroid
  for (const pp of s.plasmaPulses) {
    pp.radius += 5;
    s.asteroids = s.asteroids.filter((a) => {
      if (pp.hit.has(a.id) || !onScreen(a)) return true;
      const dist = hypot(a.x - pp.x, a.y - pp.y);
      if (dist < pp.radius + a.radius) {
        pp.hit.add(a.id);
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossFlash = ts;
          const result = bossDamage(a, 5);
          if (result === 'dead') {
            const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
            s.score += bossPts;
            addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            s.bossDefeatTime = ts;
            for (let i = 0; i < 30; i++) {
              const pa = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: cos(pa) * pspd, vy: sin(pa) * pspd,
                life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnBossDebris(s, a);
            // Destroy all remaining non-boss asteroids (not in wave 4)
            if (s.wave !== 4) {
              for (const other of s.asteroids) {
                if (other.id !== a.id && other.radius > 0) {
                  for (let i = 0; i < 6; i++) {
                    const pa2 = rand() * PI2;
                    s.particles.push({ id: uid(), x: other.x, y: other.y, vx: cos(pa2) * 2.5, vy: sin(pa2) * 2.5, life: 0.6, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
                  }
                  spawnAsteroidDebris(s, other);
                  other.radius = -1;
                }
              }
            }
            return false;
          }
          return true;
        } else {
          s.asteroidsCleared++;
          s.destroyedCount++;
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
  s.plasmaPulses = s.plasmaPulses.filter((p) => p.radius < p.maxRadius);

  // 6. Charged plasma beam â†” asteroid (line-segment vs circle)
  const now = performance.now();
  for (const cp of s.chargedPlasmas) {
    if (now > cp.startTime + cp.duration) continue;
    // beam direction unit vector
    const bdx = cos(cp.angle);
    const bdy = sin(cp.angle);
    const halfW = cp.width * 0.5 + 2; // give slight extra hitbox
    s.asteroids = s.asteroids.filter((a) => {
      if (cp.hit.has(a.id) || !onScreen(a)) return true;
      // Closest point on ray to asteroid center
      const fx = a.x - cp.x;
      const fy = a.y - cp.y;
      const t = fx * bdx + fy * bdy;
      if (t < 0) return true; // behind beam origin
      const projX = cp.x + bdx * t;
      const projY = cp.y + bdy * t;
      const dist = hypot(a.x - projX, a.y - projY);
      if (dist < halfW + a.radius) {
        cp.hit.add(a.id);
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossFlash = ts;
          const result = bossDamage(a, cp.damage);
          if (result === 'dead') {
            const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
            s.score += bossPts;
            addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            s.bossDefeatTime = ts;
            for (let i = 0; i < 30; i++) {
              const pa = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({
                id: uid(), x: a.x, y: a.y,
                vx: cos(pa) * pspd, vy: sin(pa) * pspd,
                life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnBossDebris(s, a);
            return false;
          }
          return true;
        } else {
          s.asteroidsCleared++;
          s.destroyedCount++;
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
  s.chargedPlasmas = s.chargedPlasmas.filter((p) => now < p.startTime + p.duration);

  // 7. Cross laser beams â†” asteroid (4 sweeping beams, line-segment vs circle)
  for (const cl of s.crossLasers) {
    if (now > cl.startTime + cl.duration) continue;
    const elapsed = now - cl.startTime;
    const sweepPct = min(1, elapsed / cl.duration);
    const beamLen = max(GW, GH) * 2;
    const halfW = 3.5; // beam core ~3px wide + small margin
    // Live ship position
    const isImm = s.immortalPhase === 'active';
    const clx = isImm ? s.immortalShipX : s.planetX + ORBIT_R * cos(s.playerAngle);
    const cly = isImm ? s.immortalShipY : s.planetY + ORBIT_R * sin(s.playerAngle);
    const clAngle = s.playerAngle;
    for (const spread of cl.spreads) {
      const angle = clAngle + spread * (1 - sweepPct * 2);
      const bdx = cos(angle);
      const bdy = sin(angle);
      s.asteroids = s.asteroids.filter((a) => {
        if (cl.hit.has(a.id) || !onScreen(a)) return true;
        const fx = a.x - clx;
        const fy = a.y - cly;
        const t = fx * bdx + fy * bdy;
        if (t < 0 || t > beamLen) return true;
        const projX = clx + bdx * t;
        const projY = cly + bdy * t;
        const dist = hypot(a.x - projX, a.y - projY);
        if (dist < halfW + a.radius) {
          cl.hit.add(a.id);
          if (a.isBoss && a.bossHP !== undefined) {
            a.bossFlash = ts;
            const result = bossDamage(a, 15);
            if (result === 'dead') {
              const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
              s.score += bossPts;
              addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
              s.bossDefeated = true;
              s.bossDefeatTime = ts;
              for (let i = 0; i < 30; i++) {
                const pa = rand() * PI2;
                const pspd = 2 + rand() * 4;
                s.particles.push({
                  id: uid(), x: a.x, y: a.y,
                  vx: cos(pa) * pspd, vy: sin(pa) * pspd,
                  life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
                });
              }
              spawnBossDebris(s, a);
              return false;
            }
            return true;
          } else {
            s.asteroidsCleared++;
            s.destroyedCount++;
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
  s.crossLasers = s.crossLasers.filter((cl) => now < cl.startTime + cl.duration);
  s.chainLightnings = s.chainLightnings.filter((cl) => now < cl.startTime + cl.duration);

  // 8. Player discs â€” move, spin, bounce off asteroids
  const OUTER_SPIN = 0.5;
  const INNER_SPIN = -0.7;
  for (const pd of s.playerDiscs) {
    pd.x += pd.vx;
    pd.y += pd.vy;
    pd.outerAngle += OUTER_SPIN;
    pd.innerAngle += INNER_SPIN;
    // Bounce off asteroids
    for (const a of s.asteroids) {
      if (pd.hit.has(a.id)) continue;
      const dx = a.x - pd.x;
      const dy = a.y - pd.y;
      const dist = hypot(dx, dy);
      if (dist < DISC_RADIUS + a.radius) {
        pd.hit.add(a.id);
        pd.bounces--;
        // Ricochet: find next nearest unhit asteroid and redirect
        let nextAst: typeof s.asteroids[0] | null = null;
        let nextD = 400;
        for (const b of s.asteroids) {
          if (pd.hit.has(b.id)) continue;
          const d2 = hypot(b.x - a.x, b.y - a.y);
          if (d2 < nextD) { nextAst = b; nextD = d2; }
        }
        if (nextAst) {
          const toNext = atan2(nextAst.y - pd.y, nextAst.x - pd.x);
          const spd = hypot(pd.vx, pd.vy);
          pd.vx = cos(toNext) * spd;
          pd.vy = sin(toNext) * spd;
        }
        // Damage/destroy the asteroid
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossFlash = now;
          const result = bossDamage(a, 25);
          if (result === 'dead') {
            const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
            s.score += bossPts;
            addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            s.bossDefeatTime = now;
            for (let i = 0; i < 30; i++) {
              const pa = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa) * pspd, vy: sin(pa) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
            }
            spawnBossDebris(s, a);
            a.radius = -1;
          }
        } else {
          s.asteroidsCleared++;
          s.destroyedCount++;
          const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
          s.score += pts;
          addScorePopup(s, a.x, a.y, pts);
            s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
          if (a.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
          spawnAsteroidDebris(s, a);
          // Impact sparks
          for (let i = 0; i < 6; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa) * 3, vy: sin(pa) * 3, life: 0.5, color: ['#50ff78', '#a0ffa0', '#fff', '#78ffb4'][floor(rand() * 4)] });
          }
          a.radius = -1;
        }
        break; // one collision per frame per disc
      }
    }
  }
  // Remove dead asteroids from disc collisions
  s.asteroids = s.asteroids.filter(a => a.radius > 0);
  // Clean up expired / exhausted / OOB discs
  s.playerDiscs = s.playerDiscs.filter(pd =>
    now < pd.startTime + pd.duration &&
    pd.bounces > 0 &&
    pd.x > -OOB && pd.x < GW + OOB && pd.y > -OOB && pd.y < GH + OOB
  );

  // 9. Magnet projectiles â€” move, rotate, collide with asteroids
  for (const mp of s.magnetProjectiles) {
    if (mp.held) continue; // held projectiles are moved by magnet tick
    mp.x += mp.vx;
    mp.y += mp.vy;
    mp.rotation += mp.rotSpeed;
    for (const a of s.asteroids) {
      if (mp.hit.has(a.id)) continue;
      const dx = a.x - mp.x;
      const dy = a.y - mp.y;
      const dist = hypot(dx, dy);
      if (dist < mp.radius + a.radius) {
        mp.hit.add(a.id);
        if (a.isBoss && a.bossHP !== undefined) {
          a.bossFlash = now;
          const result = bossDamage(a, 20);
          if (result === 'dead') {
            const bossPts = round(gameConfig.bossAsteroidPoints * s.multiplier);
            s.score += bossPts;
            addScorePopup(s, a.x, a.y, bossPts);
            s.killCounts.boss_asteroid = (s.killCounts.boss_asteroid || 0) + 1;
            s.bossDefeated = true;
            s.bossDefeatTime = now;
            for (let i = 0; i < 30; i++) {
              const pa2 = rand() * PI2;
              const pspd = 2 + rand() * 4;
              s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * pspd, vy: sin(pa2) * pspd, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
            }
            spawnBossDebris(s, a);
            a.radius = -1;
          }
        } else {
          s.asteroidsCleared++;
          s.destroyedCount++;
          const pts = getAsteroidPoints(a.asteroidType) * s.multiplier;
          s.score += pts;
          addScorePopup(s, a.x, a.y, pts);
            s.killCounts[a.asteroidType] = (s.killCounts[a.asteroidType] || 0) + 1;
          if (a.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(a.x, a.y, a.vx, a.vy, s));
          spawnAsteroidDebris(s, a);
          for (let i = 0; i < 6; i++) {
            const pa2 = rand() * PI2;
            s.particles.push({ id: uid(), x: a.x, y: a.y, vx: cos(pa2) * 3, vy: sin(pa2) * 3, life: 0.5, color: ['#ff5050', '#ff8080', '#fff', '#ffb0b0'][floor(rand() * 4)] });
          }
          a.radius = -1;
        }
      }
    }
  }
  s.asteroids = s.asteroids.filter(a => a.radius > 0);
  s.magnetProjectiles = s.magnetProjectiles.filter(mp =>
    mp.held ||
    (now < mp.startTime + mp.duration &&
    mp.x > -OOB && mp.x < GW + OOB && mp.y > -OOB && mp.y < GH + OOB)
  );
}

// â”€â”€ Asteroid render (regular only, bosses in AsteroidBoss.tsx) â”€â”€â”€â”€â”€

interface AsteroidsProps {
  asteroids: GameState["asteroids"];
}

const AST_IMG_MAP: Record<string, any[]> = {
  brown: BROWN_ASTEROID_IMAGES,
  blue: BLUE_ASTEROID_IMAGES,
  red: RED_ASTEROID_IMAGES,
  crystal: CRYSTAL_ASTEROID_IMAGES,
};

export default function Asteroids({ asteroids }: AsteroidsProps) {
  return (
    <>
      {asteroids
        .filter((a) => !a.isBoss && a.radius > 0)
        .map((a) => {
          const sz = a.radius * 2;
          const imgs = AST_IMG_MAP[a.asteroidType] ?? BROWN_ASTEROID_IMAGES;
          const img = imgs[a.sprite % imgs.length];
          return (
            <Image
              key={a.id}
              source={img}
              style={{
                position: "absolute",
                left: a.x - a.radius,
                top: a.y - a.radius,
                width: sz,
                height: sz,
                transform: [{ rotate: `${a.rotation}rad` }],
              }}
              resizeMode="contain"
            />
          );
        })}
    </>
  );
}
