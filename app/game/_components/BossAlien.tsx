import type { GameState, BossDisc } from "../_shared/types";
import { gameConfig } from "../_shared/gameConfig";
import {
  GW, GH, ORBIT_R, BULLET_R, PLANET_R,
  ALIEN_FLASH_DURATION, ALIEN_BEAM_WIDTH, EXPLOSION_COLORS,
  DISC_RADIUS,
  BOSS_ALIEN_RADIUS,
  BOSS_LASER_WARN_DUR, BOSS_LASER_FIRE_DUR,
  BOSS_MEGA_CHARGE_DUR, BOSS_MEGA_FIRE_DUR, BOSS_MEGA_BEAM_WIDTH,
  BOSS_EYE_OFFSETS, BOSS_EYE_SPREADS,
  BOSS_DISC_SPLIT_DUR, BOSS_DISC_SPEED,
  BUMPER_R,
} from "../_shared/constants";
import {
  uid, hypot, cos, sin, atan2, rand, PI, PI2,
  floor, max, min,
  spawnMetalDebris, addScorePopup, advanceMultiplier,
  beamPlanetDist, isInBumperArc, beamBumperClip, reflectedRayHits,
  damageShip,
} from "../_shared/helpers";

// ── Boss entry position ────────────────────────────────────────────
const BOSS_TARGET_Y = 100; // hovers near top of screen
const BOSS_ENTER_SPEED = 0.5;

// ── Attack patterns ────────────────────────────────────────────────
const IDLE_DURATION = 1500; // ms between attacks
const DISC_OUTER_SPIN = 0.5;
const DISC_INNER_SPIN = -0.7;
const SPLIT_ANGLE = PI / 4; // 45° split between the two discs
const HOMING_STRENGTH = 0.03;

function shuffleAttacks(): ('laser' | 'disc' | 'mega')[] {
  // Cycle: laser, disc, laser, disc, mega — then repeat
  const base: ('laser' | 'disc' | 'mega')[] = ['laser', 'disc', 'laser', 'disc', 'mega'];
  return base;
}

export function updateBossAlien(s: GameState, ts: number): void {
  const boss = s.alienBoss;
  if (!boss || boss.hp <= 0) return;

  const px = s.planetX + ORBIT_R * cos(s.playerAngle);
  const py = s.planetY + ORBIT_R * sin(s.playerAngle);

  boss.rotation += 0.003;

  switch (boss.state) {
    // ── Entering from top ──────────────────────────────────────────
    case 'entering': {
      boss.y += BOSS_ENTER_SPEED;
      if (boss.y >= BOSS_TARGET_Y) {
        boss.y = BOSS_TARGET_Y;
        boss.state = 'idle';
        boss.stateStart = ts;
        boss.attackQueue = shuffleAttacks();
        boss.attackIndex = 0;
      }
      break;
    }

    // ── Idle: pick next attack ─────────────────────────────────────
    case 'idle': {
      // Drift slowly side to side
      boss.x += sin(ts * 0.0008) * 0.4;
      boss.x = max(BOSS_ALIEN_RADIUS + 20, min(GW - BOSS_ALIEN_RADIUS - 20, boss.x));

      if (ts - boss.stateStart >= IDLE_DURATION) {
        const attack = boss.attackQueue[boss.attackIndex % boss.attackQueue.length];
        boss.attackIndex++;
        if (attack === 'laser') {
          boss.state = 'laser_warn';
          boss.stateStart = ts;
          boss.targetAngle = atan2(py - boss.y, px - boss.x);
        } else if (attack === 'disc') {
          boss.state = 'disc_attack';
          boss.stateStart = ts;
          spawnBossDiscPair(s, boss.x, boss.y, ts);
          // Immediately go back to idle after spawning discs
          boss.state = 'idle';
          boss.stateStart = ts;
        } else {
          // mega charge
          boss.state = 'mega_charge';
          boss.stateStart = ts;
        }
      }
      break;
    }

    // ── Laser warning: flash then fire ─────────────────────────────
    case 'laser_warn': {
      if (ts - boss.stateStart >= BOSS_LASER_WARN_DUR) {
        boss.state = 'laser_fire';
        boss.stateStart = ts;
        // Keep the same targetAngle locked during warning — don't re-aim
      }
      break;
    }

    case 'laser_fire': {
      if (ts - boss.stateStart >= BOSS_LASER_FIRE_DUR) {
        boss.state = 'idle';
        boss.stateStart = ts;
      }
      break;
    }

    // ── Mega charge: implosion + massive beam ──────────────────────
    case 'mega_charge': {
      // Boss stays still, no other attacks during charge
      // Implosion particles are handled in renderer
      if (ts - boss.stateStart >= BOSS_MEGA_CHARGE_DUR) {
        boss.state = 'mega_fire';
        boss.stateStart = ts;
        // Aim straight down toward planet
        boss.targetAngle = PI / 2; // straight down
      }
      break;
    }

    case 'mega_fire': {
      const elapsed = ts - boss.stateStart;
      if (elapsed >= BOSS_MEGA_FIRE_DUR) {
        boss.state = 'idle';
        boss.stateStart = ts;
        boss.megaDamaged = false;
        break;                     // exit before damage check
      }
      // Planet takes 1 stage of damage — once only
      if (!boss.megaDamaged && !s.immortal) {
        boss.megaDamaged = true;
        s.planetStage = min(5, s.planetStage + 1);
        s.planetFlash = ts;
      }
      break;
    }

    case 'disc_attack':
    case 'dead':
      break;
  }

  // ── Update boss discs ────────────────────────────────────────────
  for (const d of s.bossDiscs) {
    d.outerAngle += DISC_OUTER_SPIN;
    d.innerAngle += DISC_INNER_SPIN;

    if (d.phase === 'split') {
      // Fly outward in split direction
      d.x += d.vx;
      d.y += d.vy;
      if (ts - d.phaseStart >= BOSS_DISC_SPLIT_DUR) {
        d.phase = 'homing';
        d.phaseStart = ts;
      }
    } else {
      // Home toward planet
      const dx = s.planetX - d.x;
      const dy = s.planetY - d.y;
      const dist = hypot(dx, dy);
      if (dist > 1) {
        const desired = atan2(dy, dx);
        const current = atan2(d.vy, d.vx);
        let diff = desired - current;
        while (diff > PI) diff -= PI2;
        while (diff < -PI) diff += PI2;
        const newAngle = current + diff * HOMING_STRENGTH;
        const spd = hypot(d.vx, d.vy);
        d.vx = cos(newAngle) * spd;
        d.vy = sin(newAngle) * spd;
      }
      d.x += d.vx;
      d.y += d.vy;
    }
  }

  // ── Bullet ↔ boss collision ──────────────────────────────────────
  const deadB = new Set<number>();
  for (const b of s.bullets) {
    if (boss.hp <= 0) break;
    if (hypot(b.x - boss.x, b.y - boss.y) < BOSS_ALIEN_RADIUS + BULLET_R) {
      deadB.add(b.id);
      boss.hp--;
      boss.flash = ts;
      advanceMultiplier(s);
      s.hitVolleys.add(b.volley);

      for (let i = 0; i < 4; i++) {
        const pa = rand() * PI2;
        s.particles.push({
          id: uid(), x: b.x, y: b.y,
          vx: cos(pa) * 2.5, vy: sin(pa) * 2.5,
          life: 0.5, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
        });
      }

      if (boss.hp <= 0) {
        // Boss destroyed!
        const pts = Math.round(gameConfig.bossAlienPoints * s.multiplier);
        s.score += pts;
        addScorePopup(s, boss.x, boss.y, pts);
        s.killCounts.boss_alien = (s.killCounts.boss_alien || 0) + 1;
        boss.state = 'dead';
        // Big explosion
        for (let i = 0; i < 40; i++) {
          const pa = rand() * PI2;
          const spd = 2 + rand() * 4;
          s.particles.push({
            id: uid(), x: boss.x + (rand() - 0.5) * 40, y: boss.y + (rand() - 0.5) * 40,
            vx: cos(pa) * spd, vy: sin(pa) * spd,
            life: 1.5, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
          });
        }
        spawnMetalDebris(s, boss.x, boss.y, 15);
        s.bossDiscs = []; // clear any remaining discs
        s.bossDefeated = true;
        s.bossDefeatTime = ts;
      }
    }
  }
  if (deadB.size > 0) {
    s.bullets = s.bullets.filter(b => !deadB.has(b.id));
  }

  // ── Bullet ↔ boss disc collision ─────────────────────────────────
  const deadB2 = new Set<number>();
  for (const b of s.bullets) {
    for (const d of s.bossDiscs) {
      if (d.hp <= 0) continue;
      if (hypot(b.x - d.x, b.y - d.y) < DISC_RADIUS + BULLET_R) {
        deadB2.add(b.id);
        d.hp--;
        d.flash = ts;
        advanceMultiplier(s);
        s.hitVolleys.add(b.volley);

        for (let i = 0; i < 3; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: b.x, y: b.y,
            vx: cos(pa) * 2, vy: sin(pa) * 2,
            life: 0.4, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
          });
        }

        if (d.hp <= 0) {
          const pts = Math.round(gameConfig.discPoints * s.multiplier);
          s.score += pts;
          addScorePopup(s, d.x, d.y, pts);
          s.killCounts.disc = (s.killCounts.disc || 0) + 1;
          s.discShockwaves.push({
            id: uid(), x: d.x, y: d.y,
            radius: DISC_RADIUS, maxRadius: 60, startTime: ts,
          });
          for (let i = 0; i < 10; i++) {
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
  if (deadB2.size > 0) {
    s.bullets = s.bullets.filter(b => !deadB2.has(b.id));
  }
  s.bossDiscs = s.bossDiscs.filter(d => d.hp > 0);

  // ── Boss disc ↔ planet collision ─────────────────────────────────
  for (const d of s.bossDiscs) {
    if (hypot(d.x - s.planetX, d.y - s.planetY) < PLANET_R + DISC_RADIUS) {
      d.hp = 0;
      if (!s.immortal) {
        s.planetStage = min(5, s.planetStage + 1);
        s.planetFlash = ts;
        s.bulletCount = 1;
        s.destroyedCount = 0;
      }
      s.discShockwaves.push({
        id: uid(), x: d.x, y: d.y,
        radius: DISC_RADIUS, maxRadius: 40, startTime: ts,
      });
    }
  }
  s.bossDiscs = s.bossDiscs.filter(d => d.hp > 0);

  // ── Boss disc ↔ player ship collision ────────────────────────────
  if (!s.shipDestroyed && !s.immortal) {
    for (const d of s.bossDiscs) {
      if (d.hp <= 0) continue;
      const ddist = hypot(d.x - px, d.y - py);

      // Bumper bounces disc back
      if (s.bumperActive && ddist < BUMPER_R + DISC_RADIUS && isInBumperArc(d.x, d.y, px, py, s.playerAngle)) {
        const nx = (d.x - px) / (ddist || 1);
        const ny = (d.y - py) / (ddist || 1);
        const dot = d.vx * nx + d.vy * ny;
        if (dot < 0) {
          const spd = hypot(d.vx, d.vy) * 2 + 3;
          d.vx = nx * spd;
          d.vy = ny * spd;
          d.phase = 'homing'; // reset phase so it homes again
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
      else if (s.shieldActive > 0 && s.shieldHP > 0 && ddist < DISC_RADIUS + 18) {
        d.hp = 0;
        s.shieldHP--;
        s.discShockwaves.push({
          id: uid(), x: d.x, y: d.y, radius: DISC_RADIUS, maxRadius: 60, startTime: ts,
        });
      }
      // Ship hit
      else if (ddist < DISC_RADIUS + 8) {
        d.hp = 0;
        s.discShockwaves.push({
          id: uid(), x: d.x, y: d.y, radius: DISC_RADIUS, maxRadius: 60, startTime: ts,
        });
        damageShip(s, ts, px, py, 25);
        break;
      }
    }
  }

  // Remove discs off-screen
  s.bossDiscs = s.bossDiscs.filter(d => d.hp > 0 && d.y < GH + 60 && d.y > -60 && d.x > -60 && d.x < GW + 60);

  // ── Boss laser ↔ player ship collision (clipped at planet) ──────
  if (boss.state === 'laser_fire' && !s.shipDestroyed && !s.immortal) {
    const fullLen = max(GW, GH) * 2;
    const clipD = beamPlanetDist(boss.x, boss.y, boss.targetAngle, s.planetX, s.planetY);
    const beamLen = clipD > 0 ? min(clipD, fullLen) : fullLen;
    const bx2 = boss.x + cos(boss.targetAngle) * beamLen;
    const by2 = boss.y + sin(boss.targetAngle) * beamLen;
    const dx = bx2 - boss.x;
    const dy = by2 - boss.y;
    const lenSq = dx * dx + dy * dy;
    const t = max(0, min(1, ((px - boss.x) * dx + (py - boss.y) * dy) / lenSq));
    const closestX = boss.x + t * dx;
    const closestY = boss.y + t * dy;
    const dist = hypot(px - closestX, py - closestY);

    // Bumper reflects laser back at boss
    if (s.bumperActive && dist < BUMPER_R && isInBumperArc(boss.x, boss.y, px, py, s.playerAngle)) {
      const clip = beamBumperClip(boss.x, boss.y, boss.targetAngle, px, py);
      if (clip && reflectedRayHits(clip, boss.x, boss.y, BOSS_ALIEN_RADIUS)) {
        boss.hp -= max(1, Math.round(boss.maxHP * 0.1));
        boss.flash = ts;
        for (let i = 0; i < 10; i++) {
          const pa = rand() * PI2;
          s.particles.push({ id: uid(), x: closestX, y: closestY, vx: cos(pa) * 4, vy: sin(pa) * 4, life: 0.6, color: "#00ff88" });
        }
      }
    } else if (s.shieldActive > 0 && s.shieldHP > 0) {
      if (dist < ALIEN_BEAM_WIDTH + 18) {
        s.shieldHP--;
        for (let i = 0; i < 5; i++) {
          const pa = rand() * PI2;
          s.particles.push({ id: uid(), x: px, y: py, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.8, color: "#74b9ff" });
        }
      }
    } else if (dist < ALIEN_BEAM_WIDTH + 8) {
      damageShip(s, ts, px, py, 25);
    }
  }

  // ── Mega beam + eye lasers ↔ player ship collision ───────────────
  // Beams are clipped at the planet surface via ray-circle intersection
  if (boss.state === 'mega_fire' && !s.shipDestroyed && !s.immortal) {
    const fullLen = max(GW, GH) * 2;

    // --- Main mega beam (clipped by planet) ---
    {
      const clipD = beamPlanetDist(boss.x, boss.y, boss.targetAngle, s.planetX, s.planetY);
      const beamLen = clipD > 0 ? min(clipD, fullLen) : fullLen;
      const bx2 = boss.x + cos(boss.targetAngle) * beamLen;
      const by2 = boss.y + sin(boss.targetAngle) * beamLen;
      const ddx = bx2 - boss.x;
      const ddy = by2 - boss.y;
      const lenSq = ddx * ddx + ddy * ddy;
      const t = max(0, min(1, ((px - boss.x) * ddx + (py - boss.y) * ddy) / lenSq));
      const closestX = boss.x + t * ddx;
      const closestY = boss.y + t * ddy;
      const dist = hypot(px - closestX, py - closestY);

      // Bumper blocks mega beam (too powerful to reflect but blocks damage)
      if (s.bumperActive && dist < BUMPER_R && isInBumperArc(boss.x, boss.y, px, py, s.playerAngle)) {
        for (let i = 0; i < 8; i++) {
          const pa = rand() * PI2;
          s.particles.push({ id: uid(), x: closestX, y: closestY, vx: cos(pa) * 3, vy: sin(pa) * 3, life: 0.4, color: "#00ff88" });
        }
      } else if (s.shieldActive > 0 && s.shieldHP > 0) {
        if (dist < BOSS_MEGA_BEAM_WIDTH + 18) {
          s.shieldHP--;
          for (let i = 0; i < 5; i++) {
            const pa = rand() * PI2;
            s.particles.push({ id: uid(), x: px, y: py, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.8, color: "#ff6b6b" });
          }
        }
      } else if (dist < BOSS_MEGA_BEAM_WIDTH + 8) {
        damageShip(s, ts, px, py, 25);
      }
    }

    // --- 10 eye lasers (each clipped by planet) ---
    if (!s.shipDestroyed) {
      const sweepPct = min(1, (ts - boss.stateStart) / BOSS_MEGA_FIRE_DUR);

      for (let i = 0; i < BOSS_EYE_OFFSETS.length; i++) {
        const ex = boss.x + BOSS_EYE_OFFSETS[i][0];
        const ey = boss.y + BOSS_EYE_OFFSETS[i][1];
        const angle = PI / 2 + BOSS_EYE_SPREADS[i] * (1 - sweepPct);
        const clipD = beamPlanetDist(ex, ey, angle, s.planetX, s.planetY);
        const beamLen = clipD > 0 ? min(clipD, fullLen) : fullLen;
        const sx2 = ex + cos(angle) * beamLen;
        const sy2 = ey + sin(angle) * beamLen;
        const sdx = sx2 - ex;
        const sdy = sy2 - ey;
        const sLenSq = sdx * sdx + sdy * sdy;
        const st = max(0, min(1, ((px - ex) * sdx + (py - ey) * sdy) / sLenSq));
        const scX = ex + st * sdx;
        const scY = ey + st * sdy;
        const sDist = hypot(px - scX, py - scY);

        // Bumper reflects eye laser back at boss
        if (s.bumperActive && sDist < BUMPER_R && isInBumperArc(ex, ey, px, py, s.playerAngle)) {
          const clip = beamBumperClip(ex, ey, angle, px, py);
          if (clip && reflectedRayHits(clip, boss.x, boss.y, BOSS_ALIEN_RADIUS)) {
            boss.hp -= max(1, Math.round(boss.maxHP * 0.1));
            boss.flash = ts;
            for (let j = 0; j < 6; j++) {
              const pa = rand() * PI2;
              s.particles.push({ id: uid(), x: scX, y: scY, vx: cos(pa) * 3, vy: sin(pa) * 3, life: 0.5, color: "#00ff88" });
            }
            break;
          }
        } else if (s.shieldActive > 0 && s.shieldHP > 0) {
          if (sDist < ALIEN_BEAM_WIDTH + 18) {
            s.shieldHP--;
            for (let j = 0; j < 5; j++) {
              const pa = rand() * PI2;
              s.particles.push({ id: uid(), x: px, y: py, vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.8, color: "#ff6b6b" });
            }
            break;
          }
        } else if (sDist < ALIEN_BEAM_WIDTH + 8) {
          damageShip(s, ts, px, py, 25);
          break;
        }
      }
    }
  }
}

// ── Spawn a pair of homing discs ─────────────────────────────────
function spawnBossDiscPair(s: GameState, bx: number, by: number, ts: number) {
  const pairId = uid();
  const baseAngle = PI / 2; // shoot downward toward planet

  // Two discs split left and right
  for (const sign of [-1, 1]) {
    const splitAngle = baseAngle + sign * SPLIT_ANGLE;
    s.bossDiscs.push({
      id: uid(), x: bx, y: by + BOSS_ALIEN_RADIUS,
      vx: cos(splitAngle) * BOSS_DISC_SPEED,
      vy: sin(splitAngle) * BOSS_DISC_SPEED,
      outerAngle: 0, innerAngle: 0,
      hp: gameConfig.bossDiscHP, flash: 0,
      phase: 'split', phaseStart: ts, pairId,
    });
  }
}
