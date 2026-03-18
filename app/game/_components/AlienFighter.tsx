import type { GameState } from "../_shared/types";
import { gameConfig } from "../_shared/gameConfig";
import {
  GW, GH, ORBIT_R, BULLET_R, PLANET_R,
  ALIEN_RADIUS, ALIEN_SPEED, ALIEN_FLASH_DURATION, ALIEN_FLASH_COUNT,
  ALIEN_BEAM_DURATION, ALIEN_ROAM_MIN, ALIEN_ROAM_MAX,
  ALIEN_BEAM_WIDTH, EXPLOSION_COLORS,
  DISC_RADIUS, DISC_SPEED,
  BUMPER_R, SHIELD_R,
} from "../_shared/constants";
import {
  uid, hypot, cos, sin, atan2, rand, PI, PI2,
  floor, max, min, round,
  spawnMetalDebris, addScorePopup, advanceMultiplier,
  mkAlienFighter, alienWaveCount, getLevelConfig,
  beamPlanetDist, isInBumperArc, beamBumperClip, reflectedRayHits,
  damageShip,
} from "../_shared/helpers";

// ── Alien Fighter AI & collision logic ─────────────────────────────

const MARGIN = 40;
const PLANET_KEEP_DIST = ORBIT_R + 160; // stay well away from planet
const FIGHTER_ORBIT_R = ORBIT_R + 200;  // orbit radius for wave 1 fighters
const FIGHTER_ORBIT_SPD = 0.008;        // radians per frame (anti-clockwise)

/** Check if fighter is fully on-screen */
function isOnScreen(af: { x: number; y: number }) {
  return af.x >= 0 && af.x <= GW && af.y >= 0 && af.y <= GH;
}

/** Keep alien inside the play area by bouncing off edges (only once on-screen) */
function bounceEdges(af: { x: number; y: number; vx: number; vy: number }) {
  // Skip if still entering from off-screen
  if (!isOnScreen(af)) return;
  if (af.x < MARGIN) { af.x = MARGIN; af.vx = Math.abs(af.vx); }
  if (af.x > GW - MARGIN) { af.x = GW - MARGIN; af.vx = -Math.abs(af.vx); }
  if (af.y < MARGIN) { af.y = MARGIN; af.vy = Math.abs(af.vy); }
  if (af.y > GH - MARGIN) { af.y = GH - MARGIN; af.vy = -Math.abs(af.vy); }
}

/** Steer away from the planet if too close */
function avoidPlanet(af: { x: number; y: number; vx: number; vy: number }, ex: number, ey: number) {
  const dx = af.x - ex;
  const dy = af.y - ey;
  const dist = hypot(dx, dy);
  if (dist < PLANET_KEEP_DIST && dist > 0) {
    // Hard push away from planet
    const awayAngle = atan2(dy, dx);
    af.vx = cos(awayAngle) * ALIEN_SPEED * 1.5;
    af.vy = sin(awayAngle) * ALIEN_SPEED * 1.5;
    // Stronger positional nudge
    const overlap = PLANET_KEEP_DIST - dist;
    af.x += cos(awayAngle) * overlap * 0.3;
    af.y += sin(awayAngle) * overlap * 0.3;
  }
}

/** Steer toward top/bottom zones, away from the center band */
function steerTopBottom(af: { x: number; y: number; vx: number; vy: number }, ey: number) {
  // Push away from the planet's vertical center band
  const dy = af.y - ey;
  const absDy = Math.abs(dy);
  const SAFE_BAND = GH * 0.3; // stay at least 30% of screen height from planet center
  if (absDy < SAFE_BAND) {
    const pushDir = dy >= 0 ? 1 : -1;
    const strength = 0.15 * (1 - absDy / SAFE_BAND); // stronger closer to center
    af.vy += pushDir * strength;
  }
}

/** Randomly change direction occasionally while roaming */
function maybeRedirect(af: { vx: number; vy: number }) {
  if (rand() < 0.01) {
    const a = atan2(af.vy, af.vx) + (rand() - 0.5) * 1.2;
    af.vx = cos(a) * ALIEN_SPEED;
    af.vy = sin(a) * ALIEN_SPEED;
  }
}

/** Push fighters apart so they don't overlap */
const FIGHTER_SEP_DIST = ALIEN_RADIUS * 4;
function separateFighters(af: { x: number; y: number; vx: number; vy: number }, all: readonly { x: number; y: number; vx: number; vy: number; hp: number }[]) {
  for (const other of all) {
    if (other === (af as any) || other.hp <= 0) continue;
    const dx = af.x - other.x;
    const dy = af.y - other.y;
    const dist = hypot(dx, dy);
    if (dist < FIGHTER_SEP_DIST && dist > 0) {
      const push = (FIGHTER_SEP_DIST - dist) * 0.1;
      af.x += (dx / dist) * push;
      af.y += (dy / dist) * push;
    }
  }
}

export function updateAlienFighters(s: GameState, ts: number): void {
  const px = s.planetX + ORBIT_R * cos(s.playerAngle);
  const py = s.planetY + ORBIT_R * sin(s.playerAngle);

  for (const af of s.alienFighters) {
    switch (af.state) {
      case 'roaming': {
        // Evenly distribute orbit angles among active roaming fighters
        const roamers = s.alienFighters.filter(f => f.hp > 0 && (f.state === 'roaming' || f.state === 'warning' || f.state === 'cooldown') && !f.isTopBomber);
        const idx = roamers.indexOf(af);
        const count = roamers.length;
        if (count > 1 && idx >= 0) {
          // Target evenly-spaced angle
          const baseAngle = roamers[0].orbitAngle;
          const targetOA = baseAngle + (PI2 / count) * idx;
          // Gently steer toward target slot
          let slotDelta = targetOA - af.orbitAngle;
          while (slotDelta > PI) slotDelta -= PI2;
          while (slotDelta < -PI) slotDelta += PI2;
          af.orbitAngle += slotDelta * 0.02;
        }

        // Advance orbit anti-clockwise (negative = CCW in screen coords)
        af.orbitAngle -= FIGHTER_ORBIT_SPD;

        // Compute target position on the orbit circle, clamped to game field
        const rawX = s.planetX + cos(af.orbitAngle) * FIGHTER_ORBIT_R;
        const rawY = s.planetY + sin(af.orbitAngle) * FIGHTER_ORBIT_R;
        const orbitTgtX = max(MARGIN, min(GW - MARGIN, rawX));
        const orbitTgtY = max(MARGIN, min(GH - MARGIN, rawY));

        // Smoothly move toward orbit position
        const dx = orbitTgtX - af.x;
        const dy = orbitTgtY - af.y;
        const dist = hypot(dx, dy);
        if (dist > 1) {
          const catchUp = min(ALIEN_SPEED * 2, dist * 0.08);
          af.vx = (dx / dist) * catchUp;
          af.vy = (dy / dist) * catchUp;
          af.x += af.vx;
          af.y += af.vy;
        } else {
          af.x = orbitTgtX;
          af.y = orbitTgtY;
        }

        // Must be fully on screen before attacking
        if (ts >= af.nextAttack && isOnScreen(af)) {
          af.state = 'warning';
          af.flashCount = 0;
          af.flashStart = ts;
          // Lock line-of-sight toward player NOW
          af.targetAngle = atan2(py - af.y, px - af.x);
        }
        break;
      }

      case 'warning': {
        // Keep orbiting slowly while flashing
        af.orbitAngle -= FIGHTER_ORBIT_SPD * 0.3;
        const warnTgtX = max(MARGIN, min(GW - MARGIN, s.planetX + cos(af.orbitAngle) * FIGHTER_ORBIT_R));
        const warnTgtY = max(MARGIN, min(GH - MARGIN, s.planetY + sin(af.orbitAngle) * FIGHTER_ORBIT_R));
        const wdx = warnTgtX - af.x;
        const wdy = warnTgtY - af.y;
        const wdist = hypot(wdx, wdy);
        if (wdist > 1) {
          const wSpeed = min(ALIEN_SPEED * 0.6, wdist * 0.05);
          af.x += (wdx / wdist) * wSpeed;
          af.y += (wdy / wdist) * wSpeed;
        }

        const elapsed = ts - af.flashStart;
        const totalFlashTime = ALIEN_FLASH_COUNT * ALIEN_FLASH_DURATION * 2; // on+off per flash
        if (elapsed >= totalFlashTime) {
          // Done flashing → fire beam
          af.state = 'firing';
          af.fireStart = ts;
        }
        break;
      }

      case 'firing': {
        // Stationary while firing
        const elapsed = ts - af.fireStart;
        if (elapsed >= ALIEN_BEAM_DURATION) {
          // Done firing → cooldown
          af.state = 'cooldown';
          af.nextAttack = ts + ALIEN_ROAM_MIN + rand() * (ALIEN_ROAM_MAX - ALIEN_ROAM_MIN);
        }
        break;
      }

      case 'cooldown': {
        // Resume orbiting — compute orbit angle from current position
        af.orbitAngle = atan2(af.y - s.planetY, af.x - s.planetX);
        af.state = 'roaming';
        break;
      }

      case 'bombing': {
        // Wave 2: hover near top of screen, periodically drop asteroids
        const targetY = 60 + ALIEN_RADIUS;
        if (af.y < targetY) {
          af.y += ALIEN_SPEED * 0.5;
        } else {
          af.y = targetY;
          af.vy = 0;
        }
        // Drift slightly side to side
        af.x += (sin(ts * 0.001 + af.id) * 0.3);
        // Separate from other bombers
        const SEP_DIST = ALIEN_RADIUS * 3;
        for (const other of s.alienFighters) {
          if (other === af || other.hp <= 0 || other.state !== 'bombing') continue;
          const sep = other.x - af.x;
          const absSep = Math.abs(sep);
          if (absSep < SEP_DIST && absSep > 0) {
            af.x -= ((SEP_DIST - absSep) * 0.15) * Math.sign(sep);
          }
        }
        af.x = max(ALIEN_RADIUS, min(GW - ALIEN_RADIUS, af.x));

        // Spawn a disc every 2-3s (with 400ms grow-in)
        const GROW_DUR = 400;
        if (af.y >= targetY && ts - af.lastBomb > 2000 + rand() * 1000 + GROW_DUR) {
          af.lastBomb = ts;
          const scatter = (rand() - 0.5) * 0.4;
          s.alienDiscs.push({
            id: uid(), x: af.x, y: af.y + ALIEN_RADIUS,
            vx: scatter, vy: DISC_SPEED,
            outerAngle: 0, innerAngle: 0,
            hp: gameConfig.discHP, flash: 0,
            growEnd: ts + GROW_DUR,
          });
        }
        break;
      }
    }

    // ── Smooth face toward target (all non-bombing states) ──
    if (af.state !== 'bombing') {
      // While warning/firing, face the locked beam direction; otherwise track the player
      const desired = (af.state === 'warning' || af.state === 'firing')
        ? af.targetAngle
        : atan2(py - af.y, px - af.x);
      let delta = desired - af.faceAngle;
      while (delta > PI) delta -= PI2;
      while (delta < -PI) delta += PI2;
      af.faceAngle += delta * 0.08 + Math.sign(delta) * min(Math.abs(delta), 0.02);
    }
  }

  // ── Bullet ↔ alien fighter collision ────────────────────────────
  const deadB = new Set<number>();
  for (const b of s.bullets) {
    for (const af of s.alienFighters) {
      if (af.hp <= 0) continue;
      if (hypot(b.x - af.x, b.y - af.y) < ALIEN_RADIUS + BULLET_R) {
        deadB.add(b.id);
        af.hp--;
        af.flash = ts;
        advanceMultiplier(s);
        s.hitVolleys.add(b.volley);

        // Hit particles
        for (let i = 0; i < 3; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: b.x, y: b.y,
            vx: cos(pa) * 2, vy: sin(pa) * 2,
            life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
          });
        }

        if (af.hp <= 0) {
          // Alien destroyed
          const pts = round(gameConfig.alienPoints * s.multiplier);
          s.score += pts;
          addScorePopup(s, af.x, af.y, pts);
          s.killCounts.alien = (s.killCounts.alien || 0) + 1;
          for (let i = 0; i < 20; i++) {
            const pa = rand() * PI2;
            const spd = 1.5 + rand() * 3;
            s.particles.push({
              id: uid(), x: af.x, y: af.y,
              vx: cos(pa) * spd, vy: sin(pa) * spd,
              life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
            });
          }
          spawnMetalDebris(s, af.x, af.y, 6);
          s.aliensKilled++;
        }
        break; // one bullet hits one alien
      }
    }
  }
  if (deadB.size > 0) {
    s.bullets = s.bullets.filter(b => !deadB.has(b.id));
  }

  // Remove dead aliens and fighters that drifted far off-screen
  const OFF_LIMIT = 400;
  s.alienFighters = s.alienFighters.filter(af => {
    if (af.hp <= 0) return false;
    if (af.x < -OFF_LIMIT || af.x > GW + OFF_LIMIT || af.y < -OFF_LIMIT || af.y > GH + OFF_LIMIT) return false;
    return true;
  });

  // ── Wave 1 replenishment: keep 3 active until 12 total killed ──
  if (s.wave === 1) {
    const wc = alienWaveCount(1);
    while (s.alienFighters.length < wc.spawn && s.aliensKilled + s.alienFighters.length < wc.total) {
      // Count fighters in top vs bottom half to balance spawns
      const midY = s.planetY;
      let topCount = 0, botCount = 0;
      for (const f of s.alienFighters) {
        if (f.y < midY) topCount++; else botCount++;
      }
      const spawnTop = topCount <= botCount;
      s.alienFighters.push(mkAlienFighter(ts, false, spawnTop));
    }
  }

  // ── Wave 2: remove asteroids that fall past bottom ─────────────
  if (s.wave === 2) {
    s.asteroids = s.asteroids.filter(a => {
      if (a.isRain && a.y - a.radius > GH) {
        s.asteroidsCleared++;
        return false;
      }
      return true;
    });
  }

  // ── Beam ↔ player ship collision (clipped at planet) ───────────
  if (!s.shipDestroyed && !s.immortal) {
    for (const af of s.alienFighters) {
      if (af.state !== 'firing') continue;

      const fullLen = max(GW, GH) * 2;
      const clipD = beamPlanetDist(af.x, af.y, af.targetAngle, s.planetX, s.planetY);
      const beamLen = clipD > 0 ? min(clipD, fullLen) : fullLen;
      const bx2 = af.x + cos(af.targetAngle) * beamLen;
      const by2 = af.y + sin(af.targetAngle) * beamLen;
      const dx = bx2 - af.x;
      const dy = by2 - af.y;
      const lenSq = dx * dx + dy * dy;
      const t = max(0, min(1, ((px - af.x) * dx + (py - af.y) * dy) / lenSq));
      const closestX = af.x + t * dx;
      const closestY = af.y + t * dy;
      const dist = hypot(px - closestX, py - closestY);

      // Bumper reflects beam back at fighter (only if beam hits front arc)
      if (s.bumperActive && dist < BUMPER_R && isInBumperArc(af.x, af.y, px, py, s.playerAngle)) {
        const clip = beamBumperClip(af.x, af.y, af.targetAngle, px, py);
        if (clip && reflectedRayHits(clip, af.x, af.y, ALIEN_RADIUS)) {
          af.hp--;
          af.flash = ts;
          for (let i = 0; i < 8; i++) {
            const pa = rand() * PI2;
            s.particles.push({
              id: uid(), x: closestX, y: closestY,
              vx: cos(pa) * 3, vy: sin(pa) * 3, life: 0.5, color: "#00ff88",
            });
          }
          if (af.hp <= 0) {
            const pts = round(gameConfig.alienPoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, af.x, af.y, pts);
            s.killCounts.alien = (s.killCounts.alien || 0) + 1;
            s.aliensKilled++;
            for (let i = 0; i < 12; i++) {
              const pa = rand() * PI2;
              const spd = 1 + rand() * 3;
              s.particles.push({
                id: uid(), x: af.x, y: af.y,
                vx: cos(pa) * spd, vy: sin(pa) * spd, life: 0.8,
                color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnMetalDebris(s, af.x, af.y, 6);
          }
        }
      }
      // Shield absorbs beam
      else if (s.shieldActive > 0 && s.shieldHP > 0 && dist < ALIEN_BEAM_WIDTH + 18) {
        s.shieldHP--;
        for (let i = 0; i < 5; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: px, y: py,
            vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.8, color: "#74b9ff",
          });
        }
      }
      // Ship hit
      else if (dist < ALIEN_BEAM_WIDTH + 8) {
        damageShip(s, ts, px, py, 25);
        break;
      }
    }
  }
}

// ── Alien Disc update (movement, spinning, collisions) ────────────

const DISC_SHOCKWAVE_MAX_R = 60;
const DISC_SHOCKWAVE_DUR = 500; // ms

export function updateAlienDiscs(s: GameState, ts: number): void {
  const OUTER_SPIN = 0.5;   // radians per frame, clockwise
  const INNER_SPIN = -0.7;  // counter-clockwise, faster

  for (const d of s.alienDiscs) {
    // Grow phase: stay in place
    if (d.growEnd && ts < d.growEnd) {
      d.outerAngle += OUTER_SPIN;
      d.innerAngle += INNER_SPIN;
      continue;
    }
    if (d.growEnd) d.growEnd = undefined; // done growing

    // Move
    d.x += d.vx;
    d.y += d.vy;

    // Spin
    d.outerAngle += OUTER_SPIN;
    d.innerAngle += INNER_SPIN;
  }

  // Remove discs that leave the screen
  s.alienDiscs = s.alienDiscs.filter(d => d.y - DISC_RADIUS < GH + 20 && d.hp > 0);

  // ── Bullet ↔ disc collision ────────────────────────────────
  const deadB = new Set<number>();
  for (const b of s.bullets) {
    for (const d of s.alienDiscs) {
      if (d.hp <= 0) continue;
      if (d.growEnd) continue; // can't hit while growing
      if (hypot(b.x - d.x, b.y - d.y) < DISC_RADIUS + BULLET_R) {
        deadB.add(b.id);
        d.hp--;
        d.flash = ts;
        advanceMultiplier(s);
        s.hitVolleys.add(b.volley);

        // Hit sparks
        for (let i = 0; i < 3; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: b.x, y: b.y,
            vx: cos(pa) * 2, vy: sin(pa) * 2,
            life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
          });
        }

        if (d.hp <= 0) {
          // Score
          const pts = round(gameConfig.discPoints * s.multiplier);
          s.score += pts;
          addScorePopup(s, d.x, d.y, pts);
          s.killCounts.disc = (s.killCounts.disc || 0) + 1;

          // Red plasma shockwave
          s.discShockwaves.push({
            id: uid(), x: d.x, y: d.y,
            radius: DISC_RADIUS, maxRadius: DISC_SHOCKWAVE_MAX_R,
            startTime: ts,
          });

          // Red particles burst
          for (let i = 0; i < 12; i++) {
            const pa = rand() * PI2;
            const spd = 1 + rand() * 2;
            s.particles.push({
              id: uid(), x: d.x, y: d.y,
              vx: cos(pa) * spd, vy: sin(pa) * spd,
              life: 0.6, color: ["#ff4444", "#ff6b6b", "#e74c3c", "#ff8888", "#cc0000"][floor(rand() * 5)],
            });
          }
        }
      }
    }
  }
  s.bullets = s.bullets.filter(b => !deadB.has(b.id));
  s.alienDiscs = s.alienDiscs.filter(d => d.hp > 0);

  // ── Disc → planet collision ─────────────────────────────────
  for (const d of s.alienDiscs) {
    if (d.growEnd) continue;
    const dist = hypot(d.x - s.planetX, d.y - s.planetY);
    if (dist < PLANET_R + DISC_RADIUS) {
      d.hp = 0;
      if (!s.immortal) {
        s.planetStage = min(5, s.planetStage + 1);
        s.planetFlash = ts;
        s.bulletCount = 1;
        s.destroyedCount = 0;
      }
      // Small red shockwave on impact
      s.discShockwaves.push({
        id: uid(), x: d.x, y: d.y,
        radius: DISC_RADIUS, maxRadius: DISC_SHOCKWAVE_MAX_R * 0.6,
        startTime: ts,
      });
    }
  }
  s.alienDiscs = s.alienDiscs.filter(d => d.hp > 0);

  // ── Disc → player ship collision ────────────────────────────
  if (!s.shipDestroyed && !s.immortal) {
    const px = s.planetX + cos(s.playerAngle) * ORBIT_R;
    const py = s.planetY + sin(s.playerAngle) * ORBIT_R;
    for (const d of s.alienDiscs) {
      if (d.growEnd || d.hp <= 0) continue;
      const ddist = hypot(d.x - px, d.y - py);

      // Bumper bounces disc back (only if disc hits front arc)
      if (s.bumperActive && ddist < BUMPER_R + DISC_RADIUS && isInBumperArc(d.x, d.y, px, py, s.playerAngle)) {
        const nx = (d.x - px) / (ddist || 1);
        const ny = (d.y - py) / (ddist || 1);
        const dot = d.vx * nx + d.vy * ny;
        if (dot < 0) {
          const spd = hypot(d.vx, d.vy) * 2 + 3;
          d.vx = nx * spd;
          d.vy = ny * spd;
          for (let i = 0; i < 6; i++) {
            const pa = rand() * PI2;
            s.particles.push({
              id: uid(), x: d.x, y: d.y,
              vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.4, color: "#00ff88",
            });
          }
        }
      }
      // Shield absorbs disc
      else if (s.shieldActive > 0 && s.shieldHP > 0 && ddist < SHIELD_R + DISC_RADIUS) {
        d.hp = 0;
        s.shieldHP--;
        s.discShockwaves.push({
          id: uid(), x: d.x, y: d.y,
          radius: DISC_RADIUS, maxRadius: DISC_SHOCKWAVE_MAX_R,
          startTime: ts,
        });
      }
      // Ship hit
      else if (ddist < DISC_RADIUS + 8) {
        d.hp = 0;
        s.discShockwaves.push({
          id: uid(), x: d.x, y: d.y,
          radius: DISC_RADIUS, maxRadius: DISC_SHOCKWAVE_MAX_R,
          startTime: ts,
        });
        damageShip(s, ts, px, py, 25);
        break;
      }
    }
  }
  s.alienDiscs = s.alienDiscs.filter(d => d.hp > 0);

  // ── Update shockwaves ──────────────────────────────────────
  const EXPAND_SPEED = 3;
  for (const sw of s.discShockwaves) {
    sw.radius += EXPAND_SPEED;
  }
  s.discShockwaves = s.discShockwaves.filter(sw => sw.radius < sw.maxRadius);
}
