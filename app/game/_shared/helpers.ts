import type { Asteroid, AsteroidType, GameState, PowerType, PowerUp, LevelConfig, AlienFighter, AlienDrone, AlienBoss } from "./types";
import { gameConfig } from "./gameConfig";
import {
  CX, CY, GW, GH, PLANET_R, PLANET_BOTTOM_Y, SPIRAL_ARM_GAP,
  ASTEROID_BASE_SPD, ASTEROID_MIN_R, ASTEROID_MAX_R,
  POWER_SPEED, LEVELS, MAX_LEVEL,
  ALIEN_RADIUS, ALIEN_SPEED, ALIEN_ROAM_MIN, ALIEN_ROAM_MAX,
  DRONE_RADIUS,
  BOSS_ALIEN_RADIUS,
  BUMPER_ARC, BUMPER_R,
  PLASMA_COLORS, EXPLOSION_COLORS,
} from "./constants";

export const { hypot, cos, sin, atan2, random: rand, PI, floor, round, max, min, abs, ceil } = Math;
export const PI2 = PI * 2;

/** Ray-circle: dist from (ox,oy) along `angle` to near edge of planet, or -1 if no hit */
export function beamPlanetDist(ox: number, oy: number, angle: number, planetX: number, planetY: number, r = PLANET_R * 1.8): number {
  const dx = cos(angle), dy = sin(angle);
  const fx = ox - planetX, fy = oy - planetY;
  const hb = fx * dx + fy * dy;
  const c = fx * fx + fy * fy - r * r;
  const disc = hb * hb - c;
  if (disc < 0) return -1;
  const t0 = -hb - Math.sqrt(disc);
  return t0 > 0 ? t0 : -1;
}

/** True if (ox,oy) is within the front bumper arc of the ship at (px,py) facing `shipAngle` */
export function isInBumperArc(ox: number, oy: number, px: number, py: number, shipAngle: number): boolean {
  const a = atan2(oy - py, ox - px);
  let da = a - shipAngle;
  // normalize to [-PI, PI]
  da = da - PI2 * round(da / PI2);
  return abs(da) <= BUMPER_ARC;
}

/** Does the reflected ray from beamBumperClip pass within `r` of target (tx,ty)?
 *  Only checks the forward direction of the reflected ray. */
export function reflectedRayHits(
  clip: { hitX: number; hitY: number; refAngle: number },
  tx: number, ty: number, r: number,
): boolean {
  const dx = cos(clip.refAngle), dy = sin(clip.refAngle);
  const fx = tx - clip.hitX, fy = ty - clip.hitY;
  const proj = fx * dx + fy * dy;
  if (proj < 0) return false;            // target is behind the reflection
  const perpSq = fx * fx + fy * fy - proj * proj;
  return perpSq <= r * r;
}

/** Ray-circle intersection of a beam with the bumper shield.
 *  Returns hit point, reflected angle, and surface normal angle, or null. */
export function beamBumperClip(
  ox: number, oy: number, angle: number,
  shipX: number, shipY: number,
): { hitX: number; hitY: number; refAngle: number; normalAngle: number } | null {
  const ca = cos(angle), sa = sin(angle);
  const fx = ox - shipX, fy = oy - shipY;
  const hb = fx * ca + fy * sa;
  const c = fx * fx + fy * fy - BUMPER_R * BUMPER_R;
  const disc = hb * hb - c;
  if (disc < 0) return null;
  const hitT = -hb - Math.sqrt(disc);
  if (hitT <= 0) return null;
  const hitX = ox + ca * hitT;
  const hitY = oy + sa * hitT;
  const nx = (hitX - shipX) / BUMPER_R;
  const ny = (hitY - shipY) / BUMPER_R;
  const dot = ca * nx + sa * ny;
  return {
    hitX, hitY,
    refAngle: atan2(sa - 2 * dot * ny, ca - 2 * dot * nx),
    normalAngle: atan2(ny, nx),
  };
}

let _uid = 0;
export const uid = () => ++_uid;
export const resetUid = () => { _uid = 0; };

// ── Multiplier tiers (cumulative laser-on-asteroid hits) ───────────

export function advanceMultiplier(s: GameState) {
  s.comboCount++;
  s.multiplier = 1;
  for (const t of gameConfig.multiplierTiers) {
    if (s.comboCount >= t.hits) s.multiplier = t.mult;
    else break;
  }
}

export function resetMultiplier(s: GameState) {
  if (s.multiplier <= 1) return;
  // Drop one tier: 16→8→4→2→1
  const tiers = [1, ...gameConfig.multiplierTiers.map(t => t.mult)];
  const idx = tiers.indexOf(s.multiplier);
  s.multiplier = idx > 0 ? tiers[idx - 1] : 1;
  // Set comboCount to match the new tier threshold
  if (s.multiplier <= 1) {
    s.comboCount = 0;
  } else {
    for (const t of gameConfig.multiplierTiers) {
      if (t.mult === s.multiplier) { s.comboCount = t.hits; break; }
    }
  }
}

export function getMultiplierColor(m: number, ts: number): string {
  if (m >= 16) return floor(ts / 200) % 2 === 0 ? '#C0C0C0' : '#FFD700'; // flashing
  if (m >= 8)  return '#FFD700';  // gold
  if (m >= 4)  return '#C0C0C0';  // silver
  if (m >= 2)  return '#CD7F32';  // bronze
  return '#FFFFFF';                // white (1x)
}

export function getAsteroidPoints(type: AsteroidType): number {
  return gameConfig.asteroidPoints[type] ?? 25;
}

export function addScorePopup(s: GameState, x: number, y: number, pts: number) {
  const m = s.multiplier;
  const color = m >= 8 ? '#FFD700' : m >= 4 ? '#C0C0C0' : m >= 2 ? '#CD7F32' : '#fff';
  s.scorePopups.push({ id: uid(), x, y, value: pts, life: 1, color });
}

function rollAsteroidType(): AsteroidType {
  const r = rand();
  if (r < 0.005) return 'crystal';
  if (r < 0.10) return 'red';
  if (r < 0.40) return 'blue';
  return 'brown';
}

function rollSizeMultiplier(): number {
  const r = rand();
  if (r < 0.25) return 1.25;
  if (r < 0.75) return 1.5;
  return 1.65;
}

function rollSprite(): number {
  return rand() < 0.03 ? 2 : floor(rand() * 2);
}

export function getLevelConfig(lvl: number): LevelConfig {
  // For levels beyond the LEVELS array, cycle back using modulo
  // but scale difficulty (speed, asteroid count) with level number
  if (lvl > MAX_LEVEL) {
    const base = LEVELS[((lvl - 1) % MAX_LEVEL)];
    const scale = 1 + (lvl - MAX_LEVEL) * 0.005;
    const isBoss = lvl % 10 === 0;
    return {
      ...base,
      asteroids: floor(base.asteroids * scale),
      spawnDelay: max(300, floor(base.spawnDelay / scale)),
      speedMult: base.speedMult * min(3, scale),
      ...(isBoss ? { boss: { hp: 50 + lvl * 3, radius: min(150, 60 + floor(lvl / 10) * 3) } } : {}),
    };
  }
  return LEVELS[min(lvl, MAX_LEVEL) - 1];
}

export function mkAsteroid(lvl: number): Asteroid {
  const cfg = getLevelConfig(lvl);
  const fromTop = rand() < 0.5;
  const base = fromTop ? -PI / 2 : PI / 2;
  const a = base + (rand() - 0.5) * 1.6;
  const spawnDist = max(GW, GH) * 0.55 + 70;
  const scatter = (rand() - 0.5) * 0.4;
  const toward = a + PI + scatter;
  const baseRadius = ASTEROID_MIN_R + rand() * (ASTEROID_MAX_R - ASTEROID_MIN_R);
  const radius = baseRadius * rollSizeMultiplier();
  const sizeFactor = 0.6 + 0.4 * ((baseRadius - ASTEROID_MIN_R) / (ASTEROID_MAX_R - ASTEROID_MIN_R));
  const spdLvl = lvl <= 10 ? 1 : lvl;
  const spd = ((ASTEROID_BASE_SPD + min(spdLvl * 0.03, 1.5)) * cfg.speedMult + rand() * 0.3) * sizeFactor;
  const asteroidType = rollAsteroidType();
  const asteroidHP = asteroidType === 'crystal' ? 1 : (lvl <= 3 ? 1 : lvl <= 7 ? 2 : 3);
  return {
    id: uid(), x: CX + cos(a) * spawnDist, y: CY + sin(a) * spawnDist,
    vx: cos(toward) * spd, vy: sin(toward) * spd, radius,
    sprite: rollSprite(),
    rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
    hp: asteroidHP, maxHP: asteroidHP, asteroidType,
  };
}

// Wave 2: asteroid rains from top only toward planet at bottom
export function mkRainAsteroid(lvl: number, _planetY: number, slotX?: number): Asteroid {
  const cfg = getLevelConfig(lvl);
  const spawnX = slotX !== undefined ? slotX : rand() * GW;
  const spawnY = -40;
  const baseRadius = ASTEROID_MIN_R + rand() * (ASTEROID_MAX_R - ASTEROID_MIN_R);
  const radius = baseRadius * rollSizeMultiplier();
  const sizeFactor = 0.3 + 0.7 * ((baseRadius - ASTEROID_MIN_R) / (ASTEROID_MAX_R - ASTEROID_MIN_R));
  const spdLvl = lvl <= 10 ? 1 : lvl;
  const spd = ((ASTEROID_BASE_SPD + min(spdLvl * 0.03, 1.5)) * cfg.speedMult + rand() * 0.3) * sizeFactor * 2;
  const drift = (rand() - 0.5) * 0.3;
  const asteroidType = rollAsteroidType();
  const asteroidHP = asteroidType === 'crystal' ? 1 : (lvl <= 3 ? 1 : lvl <= 7 ? 2 : 3);
  return {
    id: uid(), x: spawnX, y: spawnY,
    vx: drift, vy: spd, radius,
    sprite: rollSprite(),
    rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
    hp: asteroidHP, maxHP: asteroidHP, asteroidType, isRain: true,
  };
}

// Wave 3: asteroids enter as a straight line from the right edge, then
// each one transitions onto an Archimedean spiral as it reaches the entry point.
// All share the same entry theta so the head spirals first, followers join.
export function mkOrbitRings(lvl: number, planetX: number, planetY: number): Asteroid[] {
  const count = 40;
  const spiralGap = 100;                             // tighter spiral for wave 3
  const b = spiralGap / PI2;
  const arcGap = ASTEROID_MIN_R * 2.5;              // arc distance between asteroids (~45px)
  const entryTheta = 6 * PI;                        // 3 full turns, entry to the right (cos(6π)=1)
  const entryR = b * entryTheta;                    // radius at entry point (~300px)
  const entryX = planetX + entryR;                  // entry x position (just past right edge)

  const asteroids: Asteroid[] = [];
  for (let i = 0; i < count; i++) {
    const r = ASTEROID_MIN_R * rollSizeMultiplier();
    const asteroidType = rollAsteroidType();
    const hp = asteroidType === 'crystal' ? 1 : (lvl <= 3 ? 1 : lvl <= 7 ? 2 : 3);
    asteroids.push({
      id: uid(),
      x: entryX + i * arcGap,                       // line from entry extending right
      y: planetY,
      vx: 0, vy: 0, radius: r,
      sprite: rollSprite(),
      rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.06,
      hp, maxHP: hp, asteroidType,
      isOrbiting: true, orbitAngle: entryTheta,      // all share same entry theta
      orbitRadius: 0, orbitSpeed: 0,
      spiralLerp: 0,                                 // 0=in line, 1=on spiral
    });
  }
  return asteroids;
}

export function waveAsteroidCount(lvl: number, wave: 1 | 2 | 3 | 4): number {
  if (isMercuryLevel(lvl)) return 0; // No asteroids on Mercury levels
  const cfg = getLevelConfig(lvl);
  const total = cfg.asteroids;
  if (wave === 1) return 50;
  if (wave === 2) return ceil(total * 0.3) * 3;
  if (wave === 4) return 0; // Wave 4 bosses are pre-spawned
  return 0; // Wave 3 asteroids are pre-spawned via mkOrbitRings
}

export function bossDamage(a: Asteroid, dmg: number): 'hit' | 'phaseUp' | 'dead' {
  if (!a.bossDmg) a.bossDmg = 0;
  if (!a.bossDmgMax) a.bossDmgMax = 25;
  // If toughness was already full from previous hit, now advance the phase
  if (a.bossDmg >= a.bossDmgMax) {
    a.bossDmg = 0;
    if (a.sprite < 2) {
      a.sprite++;
      // Apply remaining damage to new phase
      a.bossDmg = min(a.bossDmgMax, dmg);
      return 'phaseUp';
    }
    return 'dead';
  }
  a.bossDmg = min(a.bossDmgMax, a.bossDmg + dmg);
  return 'hit';
}

export function spawnAsteroidDebris(s: GameState, a: Asteroid) {
  const count = 3 + floor(rand() * 3);
  for (let i = 0; i < count; i++) {
    const angle = rand() * PI2;
    const spd = 0.8 + rand() * 2;
    const r = 5 + rand() * 7;
    s.debris.push({
      id: uid(), x: a.x + (rand() - 0.5) * a.radius, y: a.y + (rand() - 0.5) * a.radius,
      vx: cos(angle) * spd, vy: sin(angle) * spd, radius: r,
      sprite: a.sprite % 3,
      rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.15, life: 1, asteroidType: a.asteroidType,
    });
  }
}

export function spawnBossDebris(s: GameState, a: Asteroid) {
  const count = 10 + floor(rand() * 6);
  for (let i = 0; i < count; i++) {
    const angle = rand() * PI2;
    const spd = 1.5 + rand() * 3;
    const r = 10 + rand() * 14;
    s.debris.push({
      id: uid(), x: a.x + (rand() - 0.5) * a.radius, y: a.y + (rand() - 0.5) * a.radius,
      vx: cos(angle) * spd, vy: sin(angle) * spd, radius: r,
      sprite: floor(rand() * 3), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.1, life: 1,
    });
  }
}

export function spawnMetalDebris(s: GameState, x: number, y: number, count: number) {
  for (let i = 0; i < count; i++) {
    const angle = rand() * PI2;
    const spd = 0.5 + rand() * 2;
    const r = 4 + rand() * 6;
    s.debris.push({
      id: uid(), x: x + (rand() - 0.5) * 10, y: y + (rand() - 0.5) * 10,
      vx: cos(angle) * spd, vy: sin(angle) * spd, radius: r,
      sprite: floor(rand() * 3), rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.2, life: 1,
      isMetal: true,
    });
  }
}

/** Reduce ship health by `dmg`. Damage flows: Forcefield → Armour → Body HP.
 *  Returns true if the ship was destroyed. */
export function damageShip(s: GameState, ts: number, px: number, py: number, dmg: number): boolean {
  if (s.shipDestroyed || s.immortal) return false;
  // Beam cooldown — prevent multi-hit from continuous beams
  if (ts - s.lastShipHitTime < gameConfig.shipDamageCooldown) return false;
  s.lastShipHitTime = ts;
  const plasmaHex = PLASMA_COLORS[s.laserColor]?.hex ?? '#7c4dff';
  let remaining = dmg;

  // 1. Forcefield absorbs first
  if (s.forceFieldHP > 0) {
    const absorbed = min(s.forceFieldHP, remaining);
    s.forceFieldHP -= absorbed;
    remaining -= absorbed;
  }

  // 2. Armour absorbs next
  if (remaining > 0 && s.armourHP > 0) {
    const absorbed = min(s.armourHP, remaining);
    s.armourHP -= absorbed;
    remaining -= absorbed;
  }

  // 3. Body HP takes the rest
  if (remaining > 0) {
    s.shipHP -= remaining;
  }

  if (s.shipHP <= 0) {
    s.shipHP = 0;
    s.shipDestroyed = true;
    s.shipExplodeTime = ts;
    for (let i = 0; i < 30; i++) {
      const a = rand() * PI2;
      const spd = 1.5 + rand() * 3;
      s.particles.push({
        id: uid(), x: px, y: py,
        vx: cos(a) * spd, vy: sin(a) * spd, life: 1,
        color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
      });
    }
    spawnMetalDebris(s, px, py, 8);
    return true;
  }
  // Impact pulse in plasma core color (survived)
  for (let i = 0; i < 12; i++) {
    const a = rand() * PI2;
    const spd = 1.5 + rand() * 3;
    s.particles.push({
      id: uid(), x: px, y: py,
      vx: cos(a) * spd, vy: sin(a) * spd, life: 0.5,
      color: plasmaHex,
    });
  }
  return false;
}

export function mkBoss(lvl: number): Asteroid {
  const cfg = getLevelConfig(lvl);
  const bossInfo = cfg.boss!;
  const spawnY = -bossInfo.radius - 20;
  const dy = CY - spawnY;
  return {
    id: uid(), x: CX, y: spawnY, vx: 0, vy: (dy / Math.abs(dy)) * 0.1,
    radius: bossInfo.radius, sprite: 0,
    rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.02,
    hp: 1, maxHP: 1, isBoss: true, asteroidType: 'brown' as const,
    bossHP: bossInfo.hp, bossMaxHP: bossInfo.hp,
    bossDmg: 0, bossDmgMax: Math.ceil(bossInfo.hp / 3),
  };
}

export function mkMiniBoss(lvl: number, fromBottom: boolean, index: number): Asteroid {
  const hp = 30 + lvl * 2;
  const radius = 45;
  const spacing = GW / 5;
  const x = spacing * (index + 1);
  const spawnY = fromBottom ? GH + radius + 20 : -radius - 20;
  const vy = fromBottom ? -0.3 : 0.3;
  return {
    id: uid(), x, y: spawnY, vx: 0, vy,
    radius, sprite: 0,
    rotation: rand() * PI2, rotSpeed: (rand() - 0.5) * 0.02,
    hp: 1, maxHP: 1, isBoss: true, asteroidType: 'brown',
    bossHP: hp, bossMaxHP: hp,
    bossDmg: 0, bossDmgMax: Math.ceil(hp / 3),
  };
}

// ── Mercury / Alien Fighter helpers ────────────────────────────────

export function isMercuryLevel(lvl: number): boolean {
  return lvl >= 21 && lvl <= 30;
}

export function isMoonLevel(lvl: number): boolean {
  return lvl >= 11 && lvl <= 20;
}

export type PlanetType = 'earth' | 'moon' | 'mercury' | 'venus' | 'mars' | 'jupiter' | 'saturn' | 'uranus' | 'neptune' | 'pluto';

export function getPlanetForLevel(lvl: number): PlanetType {
  if (lvl <= 10) return 'earth';
  if (lvl <= 20) return 'moon';
  if (lvl <= 30) return 'mercury';
  if (lvl <= 40) return 'venus';
  if (lvl <= 50) return 'mars';
  if (lvl <= 60) return 'jupiter';
  if (lvl <= 70) return 'saturn';
  if (lvl <= 80) return 'uranus';
  if (lvl <= 90) return 'neptune';
  return 'pluto';
}

export const PLANET_ATMO: Record<PlanetType, [string, string]> = {
  earth:   ['rgba(30,144,255,0.35)',  'rgba(30,144,255,0)'],
  moon:    ['rgba(200,200,220,0.3)',  'rgba(200,200,220,0)'],
  mercury: ['rgba(180,140,100,0.35)', 'rgba(180,140,100,0)'],
  venus:   ['rgba(255,200,100,0.35)', 'rgba(255,200,100,0)'],
  mars:    ['rgba(200,80,50,0.35)',   'rgba(200,80,50,0)'],
  jupiter: ['rgba(200,160,100,0.35)', 'rgba(200,160,100,0)'],
  saturn:  ['rgba(210,180,140,0.35)', 'rgba(210,180,140,0)'],
  uranus:  ['rgba(100,200,220,0.35)', 'rgba(100,200,220,0)'],
  neptune: ['rgba(50,100,200,0.35)',  'rgba(50,100,200,0)'],
  pluto:   ['rgba(180,170,160,0.35)', 'rgba(180,170,160,0)'],
};

export function alienWaveCount(wave: 1 | 2 | 3 | 4): { spawn: number; total: number } {
  if (wave === 1) return { spawn: 3, total: 12 };  // 3 active at a time, 12 total
  if (wave === 2) return { spawn: 5, total: 5 };   // 5 top bombers
  if (wave === 3) return { spawn: 1, total: 1 };
  return { spawn: 0, total: 0 };
}

export function mkAlienFighter(now: number, topBomber?: boolean, spawnTop?: boolean): AlienFighter {
  if (topBomber) {
    // Wave 2: spawn from top, spread across width
    const x = GW * 0.1 + rand() * GW * 0.8;
    return {
      id: uid(), x, y: -40,
      vx: 0, vy: ALIEN_SPEED * 0.5,
      hp: gameConfig.alienHP, maxHP: gameConfig.alienHP,
      state: 'bombing',
      flashCount: 0, flashStart: 0,
      targetAngle: PI / 2, fireStart: 0,
      nextAttack: now + 1500 + rand() * 2000,
      flash: 0, faceAngle: PI / 2, orbitAngle: 0, isTopBomber: true, lastBomb: now,
    };
  }
  // Spawn from top or bottom edge based on spawnTop
  const margin = 40;
  let x: number, y: number;
  if (spawnTop !== undefined) {
    x = GW * 0.1 + rand() * GW * 0.8;
    y = spawnTop ? -margin : GH + margin;
  } else {
    // Fallback: random edge
    const edge = floor(rand() * 4);
    if (edge === 0) { x = rand() * GW; y = -margin; }
    else if (edge === 1) { x = rand() * GW; y = GH + margin; }
    else if (edge === 2) { x = -margin; y = rand() * GH; }
    else { x = GW + margin; y = rand() * GH; }
  }

  // Aim toward respective top/bottom zone
  const tgtX = GW * 0.2 + rand() * GW * 0.6;
  const tgtY = spawnTop === true ? GH * 0.15 + rand() * GH * 0.15
             : spawnTop === false ? GH * 0.7 + rand() * GH * 0.15
             : GH * 0.2 + rand() * GH * 0.6;
  const a = atan2(tgtY - y, tgtX - x);
  return {
    id: uid(), x, y,
    vx: cos(a) * ALIEN_SPEED, vy: sin(a) * ALIEN_SPEED,
    hp: gameConfig.alienHP, maxHP: gameConfig.alienHP,
    state: 'roaming',
    flashCount: 0, flashStart: 0,
    targetAngle: 0, fireStart: 0,
    nextAttack: now + ALIEN_ROAM_MIN + rand() * (ALIEN_ROAM_MAX - ALIEN_ROAM_MIN),
    flash: 0, faceAngle: a, orbitAngle: rand() * PI2, lastBomb: 0,
  };
}

/** Spawn drones in a line from the right — they'll spiral in like wave 3 asteroids */
export function spawnDrones(planetX: number, planetY: number): AlienDrone[] {
  const drones: AlienDrone[] = [];
  const count = 50;
  const spiralGap = 150;
  const b = spiralGap / PI2;
  const entryTheta = 6 * PI;
  const entryR = b * entryTheta;
  const entryX = planetX + entryR;
  const arcGap = DRONE_RADIUS * 3;

  for (let i = 0; i < count; i++) {
    drones.push({
      id: uid(),
      x: entryX + i * arcGap,
      y: planetY,
      hp: gameConfig.droneHP, maxHP: gameConfig.droneHP,
      state: 'idle',
      rotation: rand() * PI2,
      targetAngle: 0,
      flashStart: 0, fireStart: 0, flash: 0,
      lockedX: 0, lockedY: 0,
      orbitAngle: entryTheta,
      spiralLerp: 0,
    });
  }
  return drones;
}

export function mkAlienBoss(now: number): AlienBoss {
  return {
    id: uid(),
    x: CX,
    y: -BOSS_ALIEN_RADIUS - 20,
    hp: gameConfig.bossAlienHP, maxHP: gameConfig.bossAlienHP,
    state: 'entering',
    stateStart: now,
    targetAngle: PI / 2,
    flash: 0,
    rotation: 0,
    attackQueue: [],
    attackIndex: 0,
    megaDamaged: false,
  };
}

export function rollPowerType(s: GameState): PowerType {
  const r = rand();
  if (r < gameConfig.powerUpEffects.immortalityChance) return "immortality";
  const shipHasShield = s.shieldActive > 0 && s.shieldHP > 0;
  const unshieldedSats = s.satellites.filter(sat => !sat.shieldActive).length;
  const allowShield = !shipHasShield || unshieldedSats > 0;
  const allowHeal = s.planetStage > 0;
  const r2 = (r - gameConfig.powerUpEffects.immortalityChance) / (1 - gameConfig.powerUpEffects.immortalityChance);
  if (allowHeal && allowShield) {
    if (r2 < 0.30) return "shield"; if (r2 < 0.45) return "missile"; if (r2 < 0.70) return "wave"; return "heal";
  }
  if (allowHeal && !allowShield) {
    if (r2 < 0.25) return "missile"; if (r2 < 0.55) return "wave"; return "heal";
  }
  if (!allowHeal && allowShield) {
    if (r2 < 0.35) return "shield"; if (r2 < 0.55) return "missile"; return "wave";
  }
  if (r2 < 0.40) return "missile"; return "wave";
}

export function mkPowerUp(s: GameState): PowerUp {
  const a = rand() * PI2;
  const spawnDist = max(GW, GH) * 0.65 + 50;
  const toward = a + PI;
  return {
    id: uid(), x: s.planetX + cos(a) * spawnDist, y: s.planetY + sin(a) * spawnDist,
    vx: cos(toward) * POWER_SPEED, vy: sin(toward) * POWER_SPEED,
    type: rollPowerType(s),
  };
}

export function mkPowerUpAt(x: number, y: number, vx: number, vy: number, s: GameState): PowerUp {
  return { id: uid(), x, y, vx, vy, type: rollPowerType(s) };
}

export function initState(now: number, modeConfig?: import('./types').GameModeConfig): GameState {
  const startLvl = modeConfig?.startLevel ?? 1;
  return {
    playerAngle: -PI / 2, bullets: [], waves: [], asteroids: [], particles: [], powerUps: [],
    score: 0, planetHP: 100, gameOver: false, level: startLvl,
    wave: 1, spiralAngle: 0, spiralReady: false, planetX: CX, planetY: CY, planetTargetY: CY,
    asteroidsToSpawn: waveAsteroidCount(startLvl, 1), asteroidsSpawned: 0, asteroidsCleared: 0,
    lastSpawn: now, startTime: now, bulletCount: 1, destroyedCount: 0, nextBulletAt: 200,
    waveActive: 0, shieldActive: 0, shieldHP: 0, missileCount: 0, waveAmmo: 0,
    plasmaAmmo: 0, plasmaCharging: false, plasmaChargeCount: 0, plasmaChargeStart: 0, chargedPlasmas: [],
    crossLaserAmmo: 0, crossLasers: [],
    chainLightningAmmo: 0, chainLightnings: [],
    discLauncherAmmo: 0, playerDiscs: [],
    magnetAmmo: 0, magnetActive: false, magnetStart: 0, magnetCaptured: [], magnetProjectiles: [],
    selectedWeapon: 'nuke' as const, plasmaPulses: [],
    planetShield: false, levelComplete: false, levelBanner: now, lastPowerSpawn: now,
    won: false, planetStage: 1, planetFlash: 0, planetExploded: false,
    bossSpawned: false, bossDefeated: false, bossDefeatTime: 0,
    immortal: false, immortalExpire: 0, shipDestroyed: false, shipExplodeTime: 0,
    shipHP: gameConfig.shipBaseHP, shipMaxHP: gameConfig.shipBaseHP,
    armourHP: 0, armourMaxHP: 0,
    forceFieldHP: 0, forceFieldMaxHP: 0,
    lastShipHitTime: 0,
    debris: [], scorePopups: [], shipColor: 'SilverBlue', laserColor: 'Blue', showColorMenu: false,
    unlockedSkins: new Set(['SilverBlue']),
    unlockedPlasma: new Set(['Blue']),
    satellites: [], satBullets: [],
    multiplier: 1, comboCount: 0, hitVolleys: new Set(),
    alienFighters: [],
    aliensKilled: 0, aliensToKill: 0,
    alienDiscs: [], discShockwaves: [],
    alienDrones: [], nextDroneFire: 0,
    alienBoss: null, bossDiscs: [],
    bumperActive: false,
    paused: false,
    upgradeMenuOpen: false,
    upgradePoints: 0,
    killCounts: {},
    shipTargetAngle: -PI / 2,
    draggingShip: false,
    travelPhase: null,
    travelStart: 0,
    travelShipX: CX,
    travelShipY: CY,
    travelDepartX: CX,
    travelDepartY: CY,
    travelDepartRot: 0,
    travelArriveOffset: 0,
    travelBgOffset: 0,
    travelAsteroids: [],
    // Immortal phase
    immortalPhase: null,
    immortalStart: 0,
    immortalShipX: CX,
    immortalShipY: GH * 0.7,
    immortalDepartX: CX,
    immortalDepartY: CY,
    immortalDepartRot: 0,
    immortalWave: 1 as 1 | 2 | 3,
    immortalWaveStart: 0,
    immortalBoss: false,
    immortalSavedWave: 1 as 1 | 2 | 3 | 4,
    immortalSavedAsteroids: [],
    immortalSavedPlanetY: CY,
    immortalAutoFireLast: 0,
    immortalSpiralAngle: 0,
    immortalSpiralCenterY: 0,
    // Game mode
    modeConfig: modeConfig ?? null,
    elapsedMs: 0,
    checkpointLevel: modeConfig ? Math.floor((startLvl - 1) / 10) * 10 : 0,
    upgrades: {
      thrusterLevel: 0,
      blasterLevel: 1,
      homingLevel: 0,
      fireRateLevel: 0,
      nukeLevel: 1,
      waveLevel: 1,
      plasmaLevel: 0,
      crossLevel: 0,
      chainLevel: 0,
      discLevel: 0,
      magnetLevel: 0,
      shieldLevel: 0,
      hullPlatingLevel: 1,
      forceFieldLevel: 1,
    },
  };
}

export function startLevel(s: GameState, lvl: number, now: number) {
  const cfg = getLevelConfig(lvl);
  s.level = lvl;
  s.wave = 1;
  s.planetX = CX;
  s.planetY = CY;
  s.planetTargetY = CY;
  s.levelComplete = false;
  s.levelBanner = now;
  s.bossSpawned = false;
  s.bossDefeated = false;
  s.bossDefeatTime = 0;
  s.alienFighters = [];
  s.aliensKilled = 0;
  s.aliensToKill = 0;
  s.alienDiscs = [];
  s.discShockwaves = [];
  s.alienDrones = [];
  s.nextDroneFire = 0;
  s.alienBoss = null;
  s.bossDiscs = [];
  s.killCounts = {};
  s.shipHP = gameConfig.shipBaseHP;
  s.shipMaxHP = gameConfig.shipBaseHP;
  s.forceFieldMaxHP = s.upgrades.shieldLevel * 25;
  s.forceFieldHP = s.forceFieldMaxHP;

  // Boss Rush: skip waves 1-3, spawn boss directly
  if (s.modeConfig?.bossOnly) {
    s.wave = 4 as 1 | 2 | 3 | 4;
    s.asteroidsToSpawn = 0;
    s.asteroidsSpawned = 0;
    s.asteroidsCleared = 0;
    s.levelBanner = now;
    s.lastSpawn = now;
    // Alternate between asteroid bosses and alien boss every 10th boss-rush level
    if (lvl % 10 === 0) {
      // Alien boss fight
      s.planetTargetY = PLANET_BOTTOM_Y;
      s.aliensKilled = 0;
      s.aliensToKill = 1;
      s.alienBoss = mkAlienBoss(now);
      s.bossDiscs = [];
      s.bossSpawned = true;
    } else {
      // Asteroid boss with scaling HP/radius
      const bossHP = 50 + lvl * 5;
      const bossRadius = min(150, 60 + lvl * 2);
      s.planetTargetY = CY;
      s.asteroids.push({
        ...mkBoss(min(lvl, MAX_LEVEL)),
        hp: bossHP, maxHP: bossHP,
        bossHP, bossMaxHP: bossHP,
        radius: bossRadius,
      });
      s.bossSpawned = true;
    }
    return;
  }

  startWave(s, 1, now);
  // Levels with wave 4 (5, 10) spawn bosses in wave 4 instead of at level start
  const hasWave4 = lvl === 5 || lvl === 10;
  if (cfg.boss && !hasWave4 && !isMercuryLevel(lvl)) {
    s.asteroids.push(mkBoss(lvl));
    s.bossSpawned = true;
  }
}

export function startWave(s: GameState, wave: 1 | 2 | 3 | 4, now: number) {
  s.wave = wave;
  s.lastSpawn = now;
  s.levelBanner = now;

  // Mercury levels 21-30: spawn alien fighters, no asteroids
  if (isMercuryLevel(s.level)) {
    s.asteroidsToSpawn = 0;
    s.asteroidsSpawned = 0;
    s.asteroidsCleared = 0;
    s.alienFighters = [];
    s.alienDiscs = [];
    s.discShockwaves = [];

    // Level 30 wave 4: alien boss
    if (s.level === 30 && wave === 4) {
      s.planetTargetY = PLANET_BOTTOM_Y;
      s.aliensKilled = 0;
      s.aliensToKill = 1; // boss counts as 1
      s.alienBoss = mkAlienBoss(now);
      s.bossDiscs = [];
      s.bossSpawned = true;
      return;
    }

    const wc = alienWaveCount(wave);
    s.aliensKilled = 0;
    s.aliensToKill = wc.total;
    if (wave === 2) {
      // Wave 2: planet moves down, 5 top bombers
      s.planetTargetY = PLANET_BOTTOM_Y;
      for (let i = 0; i < wc.spawn; i++) {
        s.alienFighters.push(mkAlienFighter(now, true));
      }
    } else if (wave === 3) {
      // Wave 3: drones spiral in (spawned once planet reaches center)
      s.planetTargetY = CY;
      s.spiralAngle = 0;
      s.spiralReady = false;
      s.alienDrones = [];
      s.aliensToKill = 0;
      s.nextDroneFire = 0;
    } else {
      s.planetTargetY = CY;
      for (let i = 0; i < wc.spawn; i++) {
        s.alienFighters.push(mkAlienFighter(now));
      }
    }
    return;
  }

  if (wave === 1) {
    s.planetTargetY = CY;
    s.asteroidsToSpawn = waveAsteroidCount(s.level, 1);
    s.asteroidsSpawned = 0;
    s.asteroidsCleared = 0;
  } else if (wave === 2) {
    s.planetTargetY = PLANET_BOTTOM_Y;
    s.asteroidsToSpawn = waveAsteroidCount(s.level, 2);
    s.asteroidsSpawned = 0;
    s.asteroidsCleared = 0;
  } else if (wave === 3) {
    s.planetTargetY = CY;
    s.spiralAngle = 0;
    s.spiralReady = false;
    s.asteroidsToSpawn = 0;
    s.asteroidsSpawned = 0;
    s.asteroidsCleared = 0;
  } else {
    // Wave 4: Boss wave
    s.asteroidsToSpawn = 0;
    s.asteroidsSpawned = 0;
    s.asteroidsCleared = 0;
    s.bossSpawned = false;
    s.bossDefeated = false;
    s.bossDefeatTime = 0;
    if (s.level === 5) {
      // Mini Boss wave: planet to bottom, 4 mini bosses from top
      s.planetTargetY = PLANET_BOTTOM_Y;
    } else if (s.level === 10) {
      // Boss wave: planet in center, 1 big boss from top + 4 mini from bottom
      s.planetTargetY = CY;
    }
  }
}
