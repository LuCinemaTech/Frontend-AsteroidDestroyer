import { useCallback, useRef } from "react";
import type { GameState, SpecialWeapon } from "../_shared/types";
import {
  uid, cos, sin, atan2, rand, PI, PI2,
  max, min, hypot, floor, round, abs,
  bossDamage, spawnBossDebris, spawnAsteroidDebris,
  getAsteroidPoints, addScorePopup, mkPowerUpAt,
} from "../_shared/helpers";
import {
  ORBIT_R, PLAYER_H, BULLET_SPEED, MAX_BULLETS,
  PLASMA_COLORS, EXPLOSION_COLORS,
} from "../_shared/constants";

export function useFireWeapons(
  gs: React.MutableRefObject<GameState>,
  pointer: React.MutableRefObject<{ x: number; y: number }>,
  playLaserSfx: () => void,
) {
  const lastSpecialFire = useRef(0);
  const chargeHeld = useRef(false);
  const magnetHeld = useRef(false);

  const fire = useCallback(() => {
    const s = gs.current;
    if (s.gameOver || s.levelComplete || s.bullets.length >= MAX_BULLETS) return;

    playLaserSfx();

    const a = s.playerAngle;
    const isImmortal = s.immortalPhase === 'active';
    const px = isImmortal ? s.immortalShipX : s.planetX + ORBIT_R * cos(a);
    const py = isImmortal ? s.immortalShipY : s.planetY + ORBIT_R * sin(a);

    {
      const count = min(10, s.upgrades.blasterLevel);
      const perpAngle = a + PI / 2;
      const sideGap = 6;
      const rowGap = 10;
      const formations: [number, number][][] = [
        [[0, 0]],
        [[0, -sideGap], [0, sideGap]],
        [[rowGap, 0], [0, -sideGap], [0, sideGap]],
        [[rowGap, -sideGap/2], [rowGap, sideGap/2],
         [0, -sideGap], [0, sideGap]],
        [[rowGap*2, 0],
         [rowGap, -sideGap], [rowGap, sideGap],
         [0, -sideGap*1.5], [0, sideGap*1.5]],
        [[rowGap*2, 0], [rowGap, -sideGap], [rowGap, sideGap],
         [0, -sideGap*1.5], [0, sideGap*1.5], [-rowGap, 0]],
        [[rowGap*2, 0], [rowGap, -sideGap], [rowGap, sideGap],
         [0, -sideGap*1.5], [0, sideGap*1.5],
         [-rowGap, -sideGap], [-rowGap, sideGap]],
        [[rowGap*3, 0], [rowGap*2, -sideGap], [rowGap*2, sideGap],
         [rowGap, -sideGap*1.5], [rowGap, sideGap*1.5],
         [0, -sideGap*2], [0, sideGap*2], [-rowGap, 0]],
        [[rowGap*3, 0], [rowGap*2, -sideGap], [rowGap*2, sideGap],
         [rowGap, -sideGap*1.5], [rowGap, sideGap*1.5],
         [0, -sideGap*2], [0, sideGap*2],
         [-rowGap, -sideGap], [-rowGap, sideGap]],
        [[rowGap*3, 0], [rowGap*2, -sideGap], [rowGap*2, sideGap],
         [rowGap, -sideGap*1.5], [rowGap, sideGap*1.5],
         [0, -sideGap*2], [0, sideGap*2],
         [-rowGap, -sideGap*1.5], [-rowGap, sideGap*1.5],
         [-rowGap*2, 0]],
      ];
      const slots = formations[min(count, 10) - 1];
      const spd = BULLET_SPEED;
      const vid = uid();
      const homingStr = s.upgrades.homingLevel * 0.008;
      for (const [fwd, perp] of slots) {
        s.bullets.push({
          id: uid(), volley: vid,
          x: px + cos(a) * (PLAYER_H * 0.6 + fwd) + cos(perpAngle) * perp,
          y: py + sin(a) * (PLAYER_H * 0.6 + fwd) + sin(perpAngle) * perp,
          vx: cos(a) * spd,
          vy: sin(a) * spd,
          homing: homingStr,
        });
      }
    }
  }, []);

  const fireSpecial = useCallback(() => {
    const s = gs.current;
    if (s.gameOver || s.won || s.shipDestroyed) return;
    const now = performance.now();
    if (now - lastSpecialFire.current < 250) return;
    lastSpecialFire.current = now;
    const isImm = s.immortalPhase === 'active';
    if (s.selectedWeapon === 'nuke') {
      if (s.missileCount > 0) {
        s.missileCount--;
        const nukeLvl = s.upgrades.nukeLevel;
        s.plasmaPulses.push({
          id: uid(), x: isImm ? s.immortalShipX : s.planetX, y: isImm ? s.immortalShipY : s.planetY,
          radius: 30 + 5,
          maxRadius: max(GW, GH) * (0.6 + nukeLvl * 0.04), hit: new Set(),
        });
      }
    } else if (s.selectedWeapon === 'wave') {
      if (s.waveAmmo > 0) {
        s.waveAmmo--;
        const a = s.playerAngle;
        const px = isImm ? s.immortalShipX : s.planetX + ORBIT_R * cos(a);
        const py = isImm ? s.immortalShipY : s.planetY + ORBIT_R * sin(a);
        const waveLvl = s.upgrades.waveLevel;
        s.waves.push({
          id: uid(),
          x: px + cos(a) * PLAYER_H * 0.6,
          y: py + sin(a) * PLAYER_H * 0.6,
          angle: a, radius: 10, arcWidth: PI / 4 + (waveLvl - 1) * 0.05, hit: new Set(),
        });
      }
    } else if (s.selectedWeapon === 'cross') {
      if (s.crossLaserAmmo > 0) {
        s.crossLaserAmmo--;
        const a = s.playerAngle;
        const px = isImm ? s.immortalShipX : s.planetX + ORBIT_R * cos(a);
        const py = isImm ? s.immortalShipY : s.planetY + ORBIT_R * sin(a);
        const crossLvl = s.upgrades.crossLevel;
        const beamCount = 4 + floor((crossLvl - 1) / 2);
        const spreads: number[] = [];
        for (let i = 0; i < beamCount; i++) {
          spreads.push(-0.35 + (0.7 * i) / (beamCount - 1));
        }
        s.crossLasers.push({
          id: uid(), x: px, y: py, baseAngle: a,
          startTime: performance.now(), duration: 1800 + (crossLvl - 1) * 100,
          spreads,
          hit: new Set(),
        });
      }
    } else if (s.selectedWeapon === 'chain') {
      if (s.chainLightningAmmo > 0) {
        s.chainLightningAmmo--;
        const originX = isImm ? s.immortalShipX : s.planetX;
        const originY = isImm ? s.immortalShipY : s.planetY;
        const aimAngle = atan2(pointer.current.y - originY, pointer.current.x - originX);
        const sx = isImm ? s.immortalShipX : s.planetX + ORBIT_R * cos(aimAngle);
        const sy = isImm ? s.immortalShipY : s.planetY + ORBIT_R * sin(aimAngle);
        const CHAIN_RANGE = 200;
        const FIRST_RANGE = max(GW, GH);
        const FIRST_CORRIDOR = 40;
        const chainLvl = s.upgrades.chainLevel;
        const MAX_CHAINS = 12 + (chainLvl - 1) * 2;
        const links: { x1: number; y1: number; x2: number; y2: number; jags: { x: number; y: number }[] }[] = [];
        let cx = sx, cy = sy;
        const aimDx = cos(aimAngle);
        const aimDy = sin(aimAngle);
        const hit = new Set<number>();
        for (let c = 0; c < MAX_CHAINS; c++) {
          let best: typeof s.asteroids[0] | null = null;
          let bestD = c === 0 ? FIRST_RANGE : CHAIN_RANGE;
          for (const ast of s.asteroids) {
            if (hit.has(ast.id)) continue;
            const d = hypot(ast.x - cx, ast.y - cy);
            if (d >= bestD) continue;
            if (c === 0) {
              const fx = ast.x - cx;
              const fy = ast.y - cy;
              const proj = fx * aimDx + fy * aimDy;
              if (proj < 0) continue;
              const perpDist = abs(fx * aimDy - fy * aimDx);
              if (perpDist > FIRST_CORRIDOR + ast.radius) continue;
            }
            best = ast; bestD = d;
          }
          if (!best) break;
          hit.add(best.id);
          const jags: { x: number; y: number }[] = [];
          const dist = hypot(best.x - cx, best.y - cy);
          const segs = c === 0 ? 10 + floor(rand() * 6) : 5 + floor(rand() * 4);
          const jiggle = c === 0 ? 25 + dist * 0.06 : 18;
          for (let j = 1; j < segs; j++) {
            const frac = j / segs;
            const mx = cx + (best.x - cx) * frac + (rand() - 0.5) * jiggle;
            const my = cy + (best.y - cy) * frac + (rand() - 0.5) * jiggle;
            jags.push({ x: mx, y: my });
          }
          links.push({ x1: cx, y1: cy, x2: best.x, y2: best.y, jags });
          cx = best.x; cy = best.y;
        }
        if (links.length === 0) {
          const missLen = FIRST_RANGE * 0.7;
          const ex = sx + aimDx * missLen;
          const ey = sy + aimDy * missLen;
          const jags: { x: number; y: number }[] = [];
          const segs = 10 + floor(rand() * 6);
          const jiggle = 25 + missLen * 0.06;
          for (let j = 1; j < segs; j++) {
            const frac = j / segs;
            jags.push({
              x: sx + (ex - sx) * frac + (rand() - 0.5) * jiggle,
              y: sy + (ey - sy) * frac + (rand() - 0.5) * jiggle,
            });
          }
          links.push({ x1: sx, y1: sy, x2: ex, y2: ey, jags });
        }
        if (links.length > 0) {
          s.chainLightnings.push({
            id: uid(), startTime: performance.now(), duration: 600 + (chainLvl - 1) * 40, links,
          });
          s.asteroids = s.asteroids.filter((ast) => {
            if (!hit.has(ast.id)) return true;
            if (ast.isBoss && ast.bossHP !== undefined) {
              ast.bossFlash = performance.now();
              const result = bossDamage(ast, 20);
              if (result === 'dead') {
                const bossPts = round(1000 * s.multiplier);
                s.score += bossPts;
                addScorePopup(s, ast.x, ast.y, bossPts);
                s.bossDefeated = true;
                s.bossDefeatTime = performance.now();
                for (let i = 0; i < 30; i++) {
                  const pa2 = rand() * PI2;
                  const psp = 2 + rand() * 4;
                  s.particles.push({ id: uid(), x: ast.x, y: ast.y, vx: cos(pa2) * psp, vy: sin(pa2) * psp, life: 1, color: EXPLOSION_COLORS[floor(rand() * EXPLOSION_COLORS.length)] });
                }
                spawnBossDebris(s, ast);
                return false;
              }
              return true;
            }
            s.asteroidsCleared++;
            s.destroyedCount++;
            const pts = getAsteroidPoints(ast.asteroidType) * s.multiplier;
            s.score += pts;
            addScorePopup(s, ast.x, ast.y, pts);
            if (ast.asteroidType === 'crystal') s.powerUps.push(mkPowerUpAt(ast.x, ast.y, ast.vx, ast.vy, s));
            spawnAsteroidDebris(s, ast);
            for (let i = 0; i < 8; i++) {
              const pa2 = rand() * PI2;
              s.particles.push({ id: uid(), x: ast.x, y: ast.y, vx: cos(pa2) * 3, vy: sin(pa2) * 3, life: 0.5, color: ['#7efaff', '#b8f5ff', '#fff', '#a29bfe'][floor(rand() * 4)] });
            }
            return false;
          });
        }
      }
    } else if (s.selectedWeapon === 'disc') {
      if (s.discLauncherAmmo > 0) {
        s.discLauncherAmmo--;
        const aimAngle = atan2(pointer.current.y - s.planetY, pointer.current.x - s.planetX);
        const sx = s.planetX + ORBIT_R * cos(aimAngle);
        const sy = s.planetY + ORBIT_R * sin(aimAngle);
        const discLvl = s.upgrades.discLevel;
        const DISC_FLY_SPEED = 7 + (discLvl - 1) * 0.5;
        s.playerDiscs.push({
          id: uid(),
          x: sx, y: sy,
          vx: cos(aimAngle) * DISC_FLY_SPEED,
          vy: sin(aimAngle) * DISC_FLY_SPEED,
          outerAngle: 0, innerAngle: 0,
          hit: new Set(),
          bounces: 8 + (discLvl - 1) * 2,
          startTime: performance.now(),
          duration: 4000 + (discLvl - 1) * 300,
        });
      }
    }
  }, []);

  const startMagnet = useCallback(() => {
    const s = gs.current;
    if (s.gameOver || s.won || s.shipDestroyed) return;
    if (s.selectedWeapon !== 'magnet' || s.magnetAmmo <= 0) return;
    s.playerAngle = atan2(pointer.current.y - s.planetY, pointer.current.x - s.planetX);
    magnetHeld.current = true;
    s.magnetActive = true;
    s.magnetStart = performance.now();
    s.magnetAmmo--;
    s.magnetCaptured = [];
  }, []);

  const releaseMagnet = useCallback(() => {
    magnetHeld.current = false;
    const s = gs.current;
    if (!s.magnetActive) return;
    s.magnetActive = false;
    const aimAngle = atan2(pointer.current.y - s.planetY, pointer.current.x - s.planetX);
    const FLING_SPEED = 10 + (s.upgrades.magnetLevel - 1) * 1;
    const now = performance.now();
    for (const mp of s.magnetProjectiles) {
      if (!mp.held) continue;
      mp.held = false;
      mp.vx = cos(aimAngle) * FLING_SPEED;
      mp.vy = sin(aimAngle) * FLING_SPEED;
      mp.startTime = now;
      mp.duration = 3000;
    }
    s.magnetCaptured = [];
  }, []);

  const startPlasmaCharge = useCallback(() => {
    const s = gs.current;
    if (s.gameOver || s.won || s.shipDestroyed) return;
    if (s.selectedWeapon !== 'plasma' || s.plasmaAmmo <= 0) return;
    s.playerAngle = atan2(pointer.current.y - s.planetY, pointer.current.x - s.planetX);
    chargeHeld.current = true;
    s.plasmaCharging = true;
    s.plasmaChargeCount = 0;
    s.plasmaChargeStart = performance.now();
  }, []);

  const releasePlasmaCharge = useCallback(() => {
    chargeHeld.current = false;
    const s = gs.current;
    if (!s.plasmaCharging) return;
    const charges = s.plasmaChargeCount;
    s.plasmaCharging = false;
    s.plasmaChargeCount = 0;
    s.plasmaChargeStart = 0;
    if (charges <= 0) return;
    s.plasmaAmmo -= charges;
    const a = s.playerAngle;
    const shipX = s.planetX + ORBIT_R * cos(a);
    const shipY = s.planetY + ORBIT_R * sin(a);
    const plasmaLvl = s.upgrades.plasmaLevel;
    const beamWidth = 4 + charges * 3 + (plasmaLvl - 1) * 1.5;
    const beamLen = max(GW, GH) * 2;
    const beamDur = 400 + charges * 150 + (plasmaLvl - 1) * 50;
    s.chargedPlasmas.push({
      id: uid(), x: shipX, y: shipY, angle: a,
      width: beamWidth, length: beamLen,
      damage: charges * (5 + (plasmaLvl - 1)),
      startTime: performance.now(), duration: beamDur, hit: new Set(),
    });
  }, []);

  return {
    fire, fireSpecial,
    startMagnet, releaseMagnet,
    startPlasmaCharge, releasePlasmaCharge,
    chargeHeld, magnetHeld,
  };
}

// Local re-export of GW/GH for the nuke pulse radius
import { GW, GH } from "../_shared/constants";
