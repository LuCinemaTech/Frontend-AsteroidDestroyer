import type { GameState } from "../_shared/types";
import { gameConfig } from "../_shared/gameConfig";
import {
  GW, GH, ORBIT_R, BULLET_R,
  ALIEN_FLASH_DURATION, ALIEN_FLASH_COUNT,
  ALIEN_BEAM_WIDTH, EXPLOSION_COLORS,
  DRONE_RADIUS, DRONE_BEAM_DURATION,
  BUMPER_R,
} from "../_shared/constants";
import {
  uid, hypot, cos, sin, atan2, rand, PI, PI2,
  floor, max, min, round, abs,
  spawnMetalDebris, addScorePopup, advanceMultiplier,
  spawnDrones, beamPlanetDist, isInBumperArc, beamBumperClip, reflectedRayHits,
  damageShip,
} from "../_shared/helpers";

// ── Alien Drone (stationary turret) update logic ───────────────────

const DRONE_SPIN = 0.005; // slow ambient rotation (rad/frame)
const SPIRAL_GAP = 150;
const SPIRAL_B = SPIRAL_GAP / PI2;
const ENTRY_THETA = 6 * PI;
const ARC_STEP = 1.5; // px of arc-length per frame

export function updateAlienDrones(s: GameState, ts: number): void {
  const px = s.planetX + ORBIT_R * cos(s.playerAngle);
  const py = s.planetY + ORBIT_R * sin(s.playerAngle);

  // ── Spawn drones once planet reaches center (same pattern as spiral asteroids) ──
  if (s.wave === 3 && !s.spiralReady && s.alienDrones.length === 0 && abs(s.planetY - s.planetTargetY) < 1) {
    s.spiralReady = true;
    s.alienDrones = spawnDrones(s.planetX, s.planetY);
    s.aliensToKill = s.alienDrones.length;
    s.nextDroneFire = ts + 1500 + rand() * 1500;
  }

  // ── Spiral movement (same 2-phase as wave 3 asteroids) ──
  const entryX = s.planetX + SPIRAL_B * ENTRY_THETA;
  for (const d of s.alienDrones) {
    if (d.hp <= 0) continue;

    if (d.spiralLerp < 1) {
      // Phase 1: move left in a straight line toward entry point
      d.x -= ARC_STEP;
      if (d.x <= entryX) {
        d.spiralLerp = 1;
      }
    }

    if (d.spiralLerp >= 1) {
      // Phase 2: follow Archimedean spiral inward
      const theta = d.orbitAngle;
      const dTheta = ARC_STEP / Math.sqrt(SPIRAL_B * SPIRAL_B * theta * theta + SPIRAL_B * SPIRAL_B);
      d.orbitAngle -= dTheta;
      const r = SPIRAL_B * d.orbitAngle;
      if (r <= 0) {
        d.x = s.planetX; d.y = s.planetY;
      } else {
        d.x = s.planetX + cos(d.orbitAngle) * r;
        d.y = s.planetY + sin(d.orbitAngle) * r;
      }
    }
  }

  // ── Pick which drone fires next (one at a time) ──
  const aliveDrones = s.alienDrones.filter(d => d.hp > 0);
  const anyActive = aliveDrones.some(d => d.state === 'warning' || d.state === 'firing');

  if (!anyActive && aliveDrones.length > 0 && ts >= s.nextDroneFire) {
    // Pick a random idle drone
    const idle = aliveDrones.filter(d => d.state === 'idle');
    if (idle.length > 0) {
      const chosen = idle[floor(rand() * idle.length)];
      chosen.state = 'warning';
      chosen.flashStart = ts;
      // Lock onto the player's current world position
      chosen.lockedX = px;
      chosen.lockedY = py;
      chosen.targetAngle = atan2(py - chosen.y, px - chosen.x);
    }
  }

  // ── Update each drone ──
  for (const d of s.alienDrones) {
    if (d.hp <= 0) continue;

    // Slow ambient spin
    d.rotation += DRONE_SPIN;

    // Recalculate beam angle from current position to locked world point
    if (d.state === 'warning' || d.state === 'firing') {
      d.targetAngle = atan2(d.lockedY - d.y, d.lockedX - d.x);
    }

    switch (d.state) {
      case 'idle':
        break;

      case 'warning': {
        const elapsed = ts - d.flashStart;
        const totalFlashTime = ALIEN_FLASH_COUNT * ALIEN_FLASH_DURATION * 2;
        if (elapsed >= totalFlashTime) {
          d.state = 'firing';
          d.fireStart = ts;
        }
        break;
      }

      case 'firing': {
        const elapsed = ts - d.fireStart;
        if (elapsed >= DRONE_BEAM_DURATION) {
          d.state = 'idle';
          s.nextDroneFire = ts + 1000 + rand() * 2000;
        }
        break;
      }
    }
  }

  // ── Bullet ↔ drone collision ──
  const deadB = new Set<number>();
  for (const b of s.bullets) {
    for (const d of s.alienDrones) {
      if (d.hp <= 0) continue;
      if (hypot(b.x - d.x, b.y - d.y) < DRONE_RADIUS + BULLET_R) {
        deadB.add(b.id);
        d.hp--;
        d.flash = ts;
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

        if (d.hp <= 0) {
          const pts = round(gameConfig.dronePoints * s.multiplier);
          s.score += pts;
          addScorePopup(s, d.x, d.y, pts);
          s.killCounts.drone = (s.killCounts.drone || 0) + 1;
          for (let i = 0; i < 15; i++) {
            const pa = rand() * PI2;
            const spd = 1.5 + rand() * 3;
            s.particles.push({
              id: uid(), x: d.x, y: d.y,
              vx: cos(pa) * spd, vy: sin(pa) * spd,
              life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
            });
          }
          spawnMetalDebris(s, d.x, d.y, 5);
          s.aliensKilled++;
        }
        break;
      }
    }
  }
  if (deadB.size > 0) {
    s.bullets = s.bullets.filter(b => !deadB.has(b.id));
  }

  // Remove dead drones
  s.alienDrones = s.alienDrones.filter(d => d.hp > 0);

  // ── Drone beam ↔ player ship collision (clipped at planet) ──
  if (!s.shipDestroyed && !s.immortal) {
    for (const d of s.alienDrones) {
      if (d.state !== 'firing') continue;
      const fullLen = max(GW, GH) * 2;
      const clipD = beamPlanetDist(d.x, d.y, d.targetAngle, s.planetX, s.planetY);
      const beamLen = clipD > 0 ? min(clipD, fullLen) : fullLen;
      const bx2 = d.x + cos(d.targetAngle) * beamLen;
      const by2 = d.y + sin(d.targetAngle) * beamLen;
      const dx = bx2 - d.x;
      const dy = by2 - d.y;
      const lenSq = dx * dx + dy * dy;
      const t = max(0, min(1, ((px - d.x) * dx + (py - d.y) * dy) / lenSq));
      const closestX = d.x + t * dx;
      const closestY = d.y + t * dy;
      const dist = hypot(px - closestX, py - closestY);

      // Bumper reflects beam back at drone (only if beam hits front arc)
      if (s.bumperActive && dist < BUMPER_R && isInBumperArc(d.x, d.y, px, py, s.playerAngle)) {
        const clip = beamBumperClip(d.x, d.y, d.targetAngle, px, py);
        if (clip && reflectedRayHits(clip, d.x, d.y, DRONE_RADIUS)) {
          d.hp--;
          d.flash = ts;
          for (let i = 0; i < 8; i++) {
            const pa = rand() * PI2;
            s.particles.push({
              id: uid(), x: closestX, y: closestY,
              vx: cos(pa) * 3, vy: sin(pa) * 3, life: 0.5, color: "#00ff88",
            });
          }
          if (d.hp <= 0) {
            const pts = round(gameConfig.dronePoints * s.multiplier);
            s.score += pts;
            addScorePopup(s, d.x, d.y, pts);
            s.killCounts.drone = (s.killCounts.drone || 0) + 1;
            for (let i = 0; i < 12; i++) {
              const pa = rand() * PI2;
              const spd = 1 + rand() * 3;
              s.particles.push({
                id: uid(), x: d.x, y: d.y,
                vx: cos(pa) * spd, vy: sin(pa) * spd, life: 0.8,
                color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)],
              });
            }
            spawnMetalDebris(s, d.x, d.y, 6);
          }
        }
      }
      // Shield absorbs beam
      else if (s.shieldActive > 0 && s.shieldHP > 0 && dist < ALIEN_BEAM_WIDTH + 18) {
        s.shieldHP--;
        for (let i = 0; i < 5; i++) {
          const pa = rand() * PI2;
          s.particles.push({
            id: uid(), x: closestX, y: closestY,
            vx: cos(pa) * 2, vy: sin(pa) * 2, life: 0.5, color: '#4fc3f7',
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
