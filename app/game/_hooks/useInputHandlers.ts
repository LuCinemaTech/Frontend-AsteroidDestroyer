import { useEffect } from "react";
import { Platform } from "react-native";
import type { GameState, SpecialWeapon } from "../_shared/types";
import {
  uid, cos, sin, atan2, rand, PI, PI2,
  max, min, hypot,
  startLevel, startWave,
} from "../_shared/helpers";
import {
  GW, GH, OX, OY, ORBIT_R, SHIELD_MAX_HP, MAX_LEVEL,
} from "../_shared/constants";
import { gameConfig } from "../_shared/gameConfig";

export function useInputHandlers(
  gs: React.MutableRefObject<GameState>,
  pointer: React.MutableRefObject<{ x: number; y: number }>,
  fireQueue: React.MutableRefObject<number[]>,
  specialQueue: React.MutableRefObject<number[]>,
  bumperHeld: React.MutableRefObject<boolean>,
  fireSpecial: () => void,
  startPlasmaCharge: () => void,
  releasePlasmaCharge: () => void,
  startMagnet: () => void,
  releaseMagnet: () => void,
) {
  useEffect(() => {
    if (Platform.OS !== "web") return;
    const onMove = (e: MouseEvent) => {
      pointer.current = { x: e.clientX - OX, y: e.clientY - OY };
    };
    const onDown = (e: MouseEvent) => {
      if (gs.current.upgradeMenuOpen) return;
      if (e.button === 0) {
        pointer.current = { x: e.clientX - OX, y: e.clientY - OY };
        const s = gs.current;
        if (s.travelPhase === 'traveling' || s.immortalPhase === 'active') {
          s.draggingShip = true;
          return;
        }
        const shipX = s.planetX + ORBIT_R * cos(s.playerAngle);
        const shipY = s.planetY + ORBIT_R * sin(s.playerAngle);
        const dist = hypot(pointer.current.x - shipX, pointer.current.y - shipY);
        if (dist < 25) {
          s.draggingShip = true;
        } else {
          const dx = pointer.current.x - s.planetX;
          const dy = pointer.current.y - s.planetY;
          if (dx !== 0 || dy !== 0) fireQueue.current.push(atan2(dy, dx));
        }
      } else if (e.button === 1) {
        e.preventDefault();
        const s = gs.current;
        if (s.selectedWeapon === 'plasma') {
          startPlasmaCharge();
        } else if (s.selectedWeapon === 'magnet') {
          startMagnet();
        } else if (s.selectedWeapon === 'nuke') {
          fireSpecial();
        } else {
          // Directional specials: queue turn-then-fire
          const dx = pointer.current.x - s.planetX;
          const dy = pointer.current.y - s.planetY;
          if (dx !== 0 || dy !== 0) specialQueue.current.push(atan2(dy, dx));
        }
      } else if (e.button === 2) {
        bumperHeld.current = true;
      }
    };
    const onUp = (e: MouseEvent) => {
      if (e.button === 0) { gs.current.draggingShip = false; }
      if (e.button === 1) { releasePlasmaCharge(); releaseMagnet(); }
      if (e.button === 2) bumperHeld.current = false;
    };
    const onContext = (e: MouseEvent) => {
      e.preventDefault();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.code === "Escape" && !e.repeat) {
        const s = gs.current;
        if (s.gameOver || s.won) return;
        s.upgradeMenuOpen = !s.upgradeMenuOpen;
        s.paused = s.upgradeMenuOpen;
        return;
      }
      if (gs.current.upgradeMenuOpen) return;
      if (e.code === "Space" && !e.repeat) {
        const s = gs.current;
        if (s.selectedWeapon === 'plasma') startPlasmaCharge();
        else if (s.selectedWeapon === 'magnet') startMagnet();
        else if (s.selectedWeapon === 'nuke') fireSpecial();
        else {
          const dx = pointer.current.x - s.planetX;
          const dy = pointer.current.y - s.planetY;
          if (dx !== 0 || dy !== 0) specialQueue.current.push(atan2(dy, dx));
        }
      }
      // Debug cheats (dev mode only)
      if (__DEV__) {
        const s = gs.current;
        const ts = performance.now();
        if (e.code === 'Numpad1') {
          s.waveAmmo = min(200, s.waveAmmo + 5);
        } else if (e.code === 'Numpad2') {
          s.missileCount = min(99, s.missileCount + 1);
        } else if (e.code === 'Numpad3') {
          s.discLauncherAmmo = min(10, s.discLauncherAmmo + 1);
        } else if (e.code === 'Numpad4') {
          s.plasmaAmmo = min(10, s.plasmaAmmo + 1);
        } else if (e.code === 'Numpad5') {
          s.crossLaserAmmo = min(10, s.crossLaserAmmo + 1);
        } else if (e.code === 'Numpad6') {
          s.magnetAmmo = min(10, s.magnetAmmo + 1);
        } else if (e.code === 'Numpad7') {
          s.chainLightningAmmo = min(10, s.chainLightningAmmo + 1);
        } else if (e.code === 'Numpad8') {
          s.upgradePoints += 5;
        } else if (e.code === 'Numpad9') {
          s.upgradeMenuOpen = !s.upgradeMenuOpen;
          s.paused = s.upgradeMenuOpen;
        }
        if (e.code === 'NumpadDivide') {
          if (s.satellites.length > 0) s.satellites.pop();
        } else if (e.code === 'NumpadMultiply') {
          if (s.satellites.length < gameConfig.maxSatellites) {
            const a5 = rand() * PI2;
            s.satellites.push({ id: uid(), angle: a5, targetAngle: a5, lastFire: 0, shieldActive: false });
          }
        } else if (e.code === 'Numpad0') {
          if (s.immortalPhase) {
            // Cancel immortal — jump to returning
            s.immortalPhase = 'returning';
            s.immortalStart = ts;
            s.immortalDepartX = s.immortalShipX;
            s.immortalDepartY = s.immortalShipY;
            s.asteroids = [];
            s.bullets = [];
            s.draggingShip = false;
          } else {
            // Trigger immortal departure (same as power-up)
            s.immortal = true;
            s.immortalExpire = 0;
            s.immortalPhase = 'departing';
            s.immortalStart = ts;
            const sx = s.planetX + ORBIT_R * cos(s.playerAngle);
            const sy = s.planetY + ORBIT_R * sin(s.playerAngle);
            s.immortalShipX = sx;
            s.immortalShipY = sy;
            s.immortalDepartX = sx;
            s.immortalDepartY = sy;
            s.immortalDepartRot = s.playerAngle + PI / 2;
            s.immortalSavedWave = s.wave;
            s.immortalSavedAsteroids = [...s.asteroids];
            s.immortalSavedPlanetY = s.planetY;
            s.shieldActive = ts + 999999;
            s.shieldHP = SHIELD_MAX_HP;
          }
        } else if (e.code === 'NumpadDecimal') {
          if (s.shieldActive > 0) {
            s.shieldActive = 0;
          } else {
            s.shieldActive = ts + 999999;
            s.shieldHP = SHIELD_MAX_HP;
          }
        } else if (e.code === 'NumpadEnter') {
          const cycle = [2, 4, 8, 16, 1];
          const idx = cycle.indexOf(s.multiplier);
          s.multiplier = cycle[(idx + 1) % cycle.length];
        } else if (e.code === 'NumpadSubtract') {
          s.score = max(0, s.score - 100000 * s.multiplier);
        } else if (e.code === 'NumpadAdd') {
          s.score += 100000 * s.multiplier;
        }
        if (e.code === 'PageUp') {
          if (s.level % 10 === 0 && !s.travelPhase) {
            s.asteroids = [];
            s.alienFighters = [];
            s.alienDiscs = [];
            s.alienDrones = [];
            s.bossDiscs = [];
            s.alienBoss = null;
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
          } else if (s.level < MAX_LEVEL && !s.travelPhase) {
            s.asteroids = [];
            s.alienFighters = [];
            startLevel(s, s.level + 1, ts);
          }
        } else if (e.code === 'PageDown') {
          if (s.level > 1) {
            s.asteroids = [];
            s.alienFighters = [];
            startLevel(s, s.level - 1, ts);
          }
        }
        if (e.code === 'Home') {
          if (!s.travelPhase && s.level < MAX_LEVEL) {
            const tier10 = Math.ceil(s.level / 10) * 10;
            const next = min(MAX_LEVEL, tier10 === s.level ? s.level + 10 : tier10);
            s.asteroids = [];
            s.alienFighters = [];
            s.alienDiscs = [];
            s.alienDrones = [];
            s.bossDiscs = [];
            s.alienBoss = null;
            startLevel(s, next, ts);
          }
        } else if (e.code === 'End') {
          if (!s.travelPhase && s.level > 1) {
            const prev = max(1, s.level - 10);
            s.asteroids = [];
            s.alienFighters = [];
            startLevel(s, prev, ts);
          }
        }
        if (e.code === 'Insert') {
          const maxW = (s.level === 5 || s.level === 10 || s.level === 30) ? 4 : 3;
          if (s.wave < maxW) {
            s.asteroids = [];
            s.alienFighters = [];
            s.alienDiscs = [];
            s.alienDrones = [];
            s.bossDiscs = [];
            s.alienBoss = null;
            startWave(s, (s.wave + 1) as 1 | 2 | 3 | 4, ts);
          }
        } else if (e.code === 'Delete') {
          if (s.wave > 1) {
            s.asteroids = [];
            s.alienFighters = [];
            s.alienDiscs = [];
            s.alienDrones = [];
            s.bossDiscs = [];
            s.alienBoss = null;
            startWave(s, (s.wave - 1) as 1 | 2 | 3 | 4, ts);
          }
        }
      }
    };
    const onAux = (e: MouseEvent) => { if (e.button === 1) e.preventDefault(); };
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") { releasePlasmaCharge(); releaseMagnet(); }
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const s = gs.current;
      if (s.magnetActive) return;
      const owned = (['nuke', 'wave', 'plasma', 'cross', 'chain', 'disc', 'magnet'] as SpecialWeapon[]).filter(w =>
        (w === 'nuke' && s.upgrades.nukeLevel >= 1 && s.missileCount > 0) ||
        (w === 'wave' && s.upgrades.waveLevel >= 1 && s.waveAmmo > 0) ||
        (w === 'plasma' && s.upgrades.plasmaLevel >= 1 && s.plasmaAmmo > 0) ||
        (w === 'cross' && s.upgrades.crossLevel >= 1 && s.crossLaserAmmo > 0) ||
        (w === 'chain' && s.upgrades.chainLevel >= 1 && s.chainLightningAmmo > 0) ||
        (w === 'disc' && s.upgrades.discLevel >= 1 && s.discLauncherAmmo > 0) ||
        (w === 'magnet' && s.upgrades.magnetLevel >= 1 && (s.magnetAmmo > 0 || s.magnetActive))
      );
      if (owned.length === 0) return;
      const idx = owned.indexOf(s.selectedWeapon);
      const next = idx < 0 ? 0 : Math.max(0, Math.min(owned.length - 1, idx + (e.deltaY > 0 ? 1 : -1)));
      s.selectedWeapon = owned[next];
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mousedown", onDown);
    window.addEventListener("mouseup", onUp);
    window.addEventListener("auxclick", onAux);
    window.addEventListener("contextmenu", onContext);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("wheel", onWheel, { passive: false });
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("mouseup", onUp);
      window.removeEventListener("auxclick", onAux);
      window.removeEventListener("contextmenu", onContext);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("wheel", onWheel);
    };
  }, [fireSpecial, startPlasmaCharge, releasePlasmaCharge]);
}
