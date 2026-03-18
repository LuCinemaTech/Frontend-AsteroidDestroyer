import { Dimensions } from "react-native";
import type { PowerType, LevelConfig } from "./types";

const { width: RAW_W, height: RAW_H } = Dimensions.get("window");
export const GW = Math.min(RAW_W, 520);
export const GH = Math.min(RAW_H, 1100);
export const OX = (RAW_W - GW) / 2;
export const OY = (RAW_H - GH) / 2;
export const CX = GW / 2;
export const CY = GH / 2;
const SCALE = Math.min(GW, GH);

export const PLANET_R = Math.max(22, Math.round(SCALE * 0.045));
export const ORBIT_R = Math.max(80, Math.round(SCALE * 0.15));
export const PLANET_BOTTOM_Y = GH - ORBIT_R - 30;
export const SPIRAL_ARM_GAP = 150;
export const PLAYER_W = 11;
export const PLAYER_H = 18;
export const BULLET_R = 4;
export const WAVE_SPEED = 7;
export const WAVE_MAX_R = Math.max(GW, GH) * 1.5;
export const BULLET_SPEED = 9;
export const FIRE_COOLDOWN = 170;
export const ASTEROID_BASE_SPD = 0.4;
export const ASTEROID_MIN_R = 18;
export const ASTEROID_MAX_R = 26;
export const OOB = 80;
export const MAX_BULLETS = 200;
export const SHIELD_R = 28;
export const SHIELD_MAX_HP = 5;
export const BUMPER_R = 35;
export const BUMPER_ARC = Math.PI / 3;  // half-angle of front arc (~60° each side = 120° total)
export const POWER_SPEED = 1.2;
export const POWER_R = 14;
export const POWER_SPAWN_INTERVAL = 8000;

// ── Alien Fighter constants ────────────────────────────────────────
export const ALIEN_RADIUS = 28;
export const ALIEN_SPEED = 1.2;
export const ALIEN_FLASH_DURATION = 400;  // ms per flash
export const ALIEN_FLASH_COUNT = 3;
export const ALIEN_BEAM_DURATION = 800;   // ms beam stays active
export const ALIEN_ROAM_MIN = 3000;       // min ms before next attack
export const ALIEN_ROAM_MAX = 6000;       // max ms before next attack
export const ALIEN_BEAM_WIDTH = 4;

export const SAT_FIRE_COOLDOWN = 800;
export const SAT_BULLET_SPEED = 7;
export const SAT_AIM_SPEED = 0.025;
export const SAT_AIM_TOLERANCE = 0.12;

// ── Stars ──────────────────────────────────────────────────────────

const STAR_COLORS = ["#ffffff", "#ffe4c4", "#c4d4ff", "#ffd2e0"];
export const STARS = Array.from({ length: 100 }, (_, i) => {
  const slow = i < 50;
  return {
    x: Math.random() * GW,
    y: Math.random() * GH,
    r: 0.5 + Math.random() * 1.2,
    o: 0.4 + Math.random() * 0.6,
    c: STAR_COLORS[Math.floor(Math.random() * STAR_COLORS.length)],
    phase: Math.random() * Math.PI * 2,
    speed: slow ? 0.0003 + Math.random() * 0.001 : 0.001 + Math.random() * 0.004,
    phase2: Math.random() * Math.PI * 2,
    speed2: slow ? 0.001 + Math.random() * 0.002 : 0.003 + Math.random() * 0.006,
  };
});

export const EXPLOSION_COLORS = ["#ff6b6b", "#ffa502", "#fdcb6e", "#ff7675"];

// ── Images ─────────────────────────────────────────────────────────

export const BROWN_ASTEROID_IMAGES: any[] = [
  require("../../../assets/images/Asteroids/Magnetite-Asteroid01.png"),
  require("../../../assets/images/Asteroids/Magnetite-Asteroid02.png"),
  require("../../../assets/images/Asteroids/Magnetite-Asteroid03.png"),
];

export const BLUE_ASTEROID_IMAGES: any[] = [
  require("../../../assets/images/Asteroids/Cyro-Silicate-Asteroid01.png"),
  require("../../../assets/images/Asteroids/Cyro-Silicate-Asteroid02.png"),
  require("../../../assets/images/Asteroids/Cyro-Silicate-Asteroid03.png"),
];

export const RED_ASTEROID_IMAGES: any[] = [
  require("../../../assets/images/Asteroids/Hematite-Asteroid01.png"),
  require("../../../assets/images/Asteroids/Hematite-Asteroid02.png"),
  require("../../../assets/images/Asteroids/Hematite-Asteroid03.png"),
];

export const CRYSTAL_ASTEROID_IMAGES: any[] = [
  require("../../../assets/images/Crystals/Diamond-Crystals01.png"),
  require("../../../assets/images/Crystals/Emerald-Crystals01.png"),
  require("../../../assets/images/Crystals/Ruby-Crystals01.png"),
];

export const BOSS_ASTEROID_IMAGES = [
  require("../../../assets/images/Asteroids/Ekana-Asteroid01.png"),
  require("../../../assets/images/Asteroids/Ekana-Asteroid02.png"),
  require("../../../assets/images/Asteroids/Ekana-Asteroid03.png"),
];

export const PHOTON_BLASTER_IMAGES: Record<string, any> = {
  Blue: require("../../../assets/images/Weapons/Photon-Blaster-Blue.png"),
  Red: require("../../../assets/images/Weapons/Photon-Blaster-Red.png"),
};

export const PLASMA_COLORS: Record<string, { label: string; rgb: [number, number, number]; hex: string }> = {
  Blue:   { label: "Blue",   rgb: [30, 144, 255],  hex: "#1e90ff" },
  Yellow: { label: "Yellow", rgb: [255, 234, 50],   hex: "#ffea32" },
  Orange: { label: "Orange", rgb: [255, 140, 0],    hex: "#ff8c00" },
  Red:    { label: "Red",    rgb: [231, 76, 60],    hex: "#e74c3c" },
  Purple: { label: "Purple", rgb: [162, 93, 220],   hex: "#a25ddc" },
  Silver: { label: "Silver", rgb: [192, 200, 220],  hex: "#c0c8dc" },
  Gold:   { label: "Gold",   rgb: [255, 215, 0],    hex: "#ffd700" },
};

export const SHIP_IMAGES: Record<string, any> = {
  SilverBlue: require("../../../assets/images/Starships/Ship-SilverBlue.png"),
  BlackRed: require("../../../assets/images/Starships/Ship-BlackRed.png"),
  Gold: require("../../../assets/images/Starships/Ship-Gold.png"),
  AlienBlue: require("../../../assets/images/Starships/Ship-AlienBlue.png"),
  AlienRed: require("../../../assets/images/Starships/Ship-AlienRed.png"),
};
export const MERCURY_IMAGES = [
  require("../../../assets/images/Level 21 - 30/Mercury01.png"),
  require("../../../assets/images/Level 21 - 30/Mercury02.png"),
  require("../../../assets/images/Level 21 - 30/Mercury03.png"),
  require("../../../assets/images/Level 21 - 30/Mercury04.png"),
];

export const MOON_IMAGES = [
  require("../../../assets/images/Level 11 - 20/Moon01.png"),
  require("../../../assets/images/Level 11 - 20/Moon02.png"),
  require("../../../assets/images/Level 11 - 20/Moon03.png"),
  require("../../../assets/images/Level 11 - 20/Moon04.png"),
];

export const VENUS_IMAGES = [
  require("../../../assets/images/Level 31 - 40/Venus01.png"),
  require("../../../assets/images/Level 31 - 40/Venus02.png"),
  require("../../../assets/images/Level 31 - 40/Venus03.png"),
  require("../../../assets/images/Level 31 - 40/Venus04.png"),
];

export const MARS_IMAGES = [
  require("../../../assets/images/Level 41 - 50/Mars01.png"),
  require("../../../assets/images/Level 41 - 50/Mars02.png"),
  require("../../../assets/images/Level 41 - 50/Mars03.png"),
  require("../../../assets/images/Level 41 - 50/Mars04.png"),
];

export const JUPITER_IMAGES = [
  require("../../../assets/images/Level 51 -60/Jupiter01.png"),
  require("../../../assets/images/Level 51 -60/Jupiter02.png"),
  require("../../../assets/images/Level 51 -60/Jupiter03.png"),
  require("../../../assets/images/Level 51 -60/Jupiter04.png"),
];

export const SATURN_IMAGES = [
  require("../../../assets/images/Level 61 - 70/Saturn01.png"),
  require("../../../assets/images/Level 61 - 70/Saturn02.png"),
  require("../../../assets/images/Level 61 - 70/Saturn03.png"),
  require("../../../assets/images/Level 61 - 70/Saturn04.png"),
];

export const URANUS_IMAGES = [
  require("../../../assets/images/Level 71 - 80/Uranus01.png"),
  require("../../../assets/images/Level 71 - 80/Uranus02.png"),
  require("../../../assets/images/Level 71 - 80/Uranus03.png"),
  require("../../../assets/images/Level 71 - 80/Uranus04.png"),
];

export const NEPTUNE_IMAGES = [
  require("../../../assets/images/Level 81 - 90/Neptune01.png"),
  require("../../../assets/images/Level 81 - 90/Neptune02.png"),
  require("../../../assets/images/Level 81 - 90/Neptune03.png"),
  require("../../../assets/images/Level 81 - 90/Neptune04.png"),
];

export const PLUTO_IMAGES = [
  require("../../../assets/images/Level 91 - 100/Pluto01.png"),
  require("../../../assets/images/Level 91 - 100/Pluto02.png"),
  require("../../../assets/images/Level 91 - 100/Pluto03.png"),
  require("../../../assets/images/Level 91 - 100/Pluto04.png"),
];

export const ALIEN_FIGHTER_BLUE = require("../../../assets/images/Starships/Ship-AlienBlue.png");
export const ALIEN_FIGHTER_RED = require("../../../assets/images/Starships/Ship-AlienRed.png");
export const ALIEN_DISC_IMAGE = require("../../../assets/images/Weapons/Plasma-Disc.png");

export const ALIEN_DRONE_BLUE = require("../../../assets/images/Ekana/Drones/Alien-Drone1a.png");
export const ALIEN_DRONE_RED = require("../../../assets/images/Ekana/Drones/Alien-Drone1b.png");
export const DRONE_RADIUS = 24;
export const DRONE_BEAM_DURATION = 800;

export const DISC_RADIUS = 30;
export const DISC_SPEED = 2.5;

// ── Alien Boss (Level 30) ──────────────────────────────────────────
export const BOSS_ALIEN_IMAGE = require("../../../assets/images/Ekana/Warship/Ship-ExoticBlue.png");
export const BOSS_ALIEN_AWAKENED = require("../../../assets/images/Ekana/Warship/Ship-ExoticBlueAwakened.png");
export const BOSS_ALIEN_RADIUS = 100;
export const BOSS_LASER_WARN_DUR = 2400;    // ms warning flashes
export const BOSS_LASER_FIRE_DUR = 1200;    // ms beam stays active
export const BOSS_MEGA_CHARGE_DUR = 5000;   // ms charge (implosion)
export const BOSS_MEGA_FIRE_DUR = 2000;     // ms mega beam
export const BOSS_MEGA_BEAM_WIDTH = 20;     // px wide
export const BOSS_DISC_SPLIT_DUR = 800;     // ms discs fly apart
export const BOSS_DISC_SPEED = 2.5;

// 10 eye positions (dx,dy offsets from boss center) — V-arc on lower face
export const BOSS_EYE_OFFSETS: [number, number][] = [
  [-35, 15], [-25, 32], [-16, 45], [-9, 55], [-4, 62],
  [4, 62],   [9, 55],   [16, 45],  [25, 32], [35, 15],
];
// Starting spread for each eye beam (radians from PI/2 straight down)
export const BOSS_EYE_SPREADS: number[] = [
  -0.35, -0.28, -0.21, -0.14, -0.07,
   0.07,  0.14,  0.21,  0.28,  0.35,
];

export const SHIP_GOLD_IMAGE = require("../../../assets/images/Starships/Ship-Gold.png");
export const EARTH_GOLD_IMAGE = require("../../../assets/images/Level 1 - 10/Earth/Earth-Gold.png");
export const WAVE_ARC_IMAGE = require("../../../assets/images/Weapons/Wave-arc.gif");
export const SATELLITE_IMAGE = require("../../../assets/images/Drones/Satelite-Drone01.png");
export const SATELLITE_GOLD_IMAGE = require("../../../assets/images/Drones/Satelite-Drone01-Gold.png");
export const SPACE_BG = require("../../../assets/images/Menus/Space-Background.png");
export const MAIN_MENU_BG = require("../../../assets/images/Menus/MainMenu.png");
export const GAME_MUSIC = require("../../../assets/sounds/music/GameMusic.mp3");

export const POWER_ICONS: Record<PowerType, any> = {
  wave: require("../../../assets/images/Icons/Icon-Wave.png"),
  shield: require("../../../assets/images/Icons/Icon-Shield.png"),
  missile: require("../../../assets/images/Icons/Icon-Nuke.png"),
  heal: require("../../../assets/images/Icons/Icon-Health.png"),
  immortality: require("../../../assets/images/Icons/Icon-Immortality.png"),
};

export const EARTH_IMAGES = [
  require("../../../assets/images/Level 1 - 10/Earth/Earth01.png"),
  require("../../../assets/images/Level 1 - 10/Earth/Earth02.png"),
  require("../../../assets/images/Level 1 - 10/Earth/Earth03.png"),
  require("../../../assets/images/Level 1 - 10/Earth/Earth04.png"),
];

export const ATMO_COLORS: [string, string][] = [
  ["rgba(255,255,255,0.4)", "rgba(255,255,255,0)"],
  ["rgba(30,144,255,0.35)", "rgba(30,144,255,0)"],
  ["rgba(255,215,0,0.35)", "rgba(255,215,0,0)"],
  ["rgba(255,140,0,0.35)", "rgba(255,140,0,0)"],
  ["rgba(255,50,30,0.35)", "rgba(255,50,30,0)"],
];

// ── Level config (100 levels) ──────────────────────────────────────

const SPEED_TIERS = [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0];

export const LEVELS: LevelConfig[] = Array.from({ length: 100 }, (_, i) => {
  const lvl = i + 1;
  const tier = Math.min(9, Math.floor((lvl - 1) / 10));
  const effectiveLvl = lvl <= 10 ? 1 : lvl;
  const asteroids = 25 + (effectiveLvl - 1) * 3;
  const spawnDelay = Math.max(600, 2000 - (effectiveLvl - 1) * 14);
  const maxOnScreen = Math.min(30, 6 + Math.floor((effectiveLvl - 1) * 0.25));
  const speedMult = lvl <= 10 ? SPEED_TIERS[0] : SPEED_TIERS[tier];
  const isBossLevel = lvl % 10 === 0;
  const bossHP = isBossLevel ? 50 + lvl * 3 : undefined;
  const bossRadius = isBossLevel ? Math.min(130, 60 + Math.floor(lvl / 10) * 8) : undefined;
  return {
    asteroids,
    spawnDelay,
    maxOnScreen,
    speedMult,
    ...(isBossLevel ? { boss: { hp: bossHP!, radius: bossRadius! } } : {}),
  };
});

export const MAX_LEVEL = LEVELS.length;
