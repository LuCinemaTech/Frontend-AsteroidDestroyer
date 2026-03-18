export interface Bullet {
  id: number; x: number; y: number; vx: number; vy: number; volley: number;
  homing: number; // 0 = straight, higher = stronger tracking
}

export interface Wave {
  id: number; x: number; y: number; angle: number; radius: number; arcWidth: number; hit: Set<number>;
}

export interface PlasmaPulse {
  id: number; x: number; y: number; radius: number; maxRadius: number; hit: Set<number>;
}

export type AsteroidType = 'brown' | 'blue' | 'red' | 'crystal';

export type AlienState = 'roaming' | 'warning' | 'firing' | 'cooldown' | 'bombing';
export type DroneState = 'idle' | 'warning' | 'firing';
export type BossState = 'entering' | 'idle' | 'laser_warn' | 'laser_fire' | 'disc_attack' | 'mega_charge' | 'mega_fire' | 'dead';

export interface AlienBoss {
  id: number;
  x: number; y: number;
  hp: number; maxHP: number;
  state: BossState;
  stateStart: number;       // ts when current state began
  targetAngle: number;      // locked laser direction
  flash: number;            // ts of last hit-flash
  rotation: number;         // slow ambient spin
  attackQueue: ('laser' | 'disc' | 'mega')[];  // shuffled attack queue
  attackIndex: number;      // current position in queue
  megaDamaged: boolean;     // true once mega beam has dealt planet damage
}

export interface BossDisc {
  id: number; x: number; y: number; vx: number; vy: number;
  outerAngle: number; innerAngle: number;
  hp: number; flash: number;
  phase: 'split' | 'homing';  // split apart, then home toward planet
  phaseStart: number;
  pairId: number;              // links the two discs in a pair
}

export interface AlienDrone {
  id: number;
  x: number; y: number;
  hp: number; maxHP: number;
  state: DroneState;
  rotation: number;         // slow ambient spin
  targetAngle: number;      // locked beam direction
  lockedX: number;          // world X the drone aims at
  lockedY: number;          // world Y the drone aims at
  flashStart: number;       // ts when warning flashes began
  fireStart: number;        // ts when beam started
  flash: number;            // ts of last hit-flash
  orbitAngle: number;       // current angle on Archimedean spiral
  spiralLerp: number;       // 0 = in line, 1 = on spiral
}

export interface AlienFighter {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  hp: number; maxHP: number;
  state: AlienState;
  flashCount: number;       // how many flashes completed so far
  flashStart: number;       // ts when current flash cycle began
  targetAngle: number;      // locked line-of-sight angle toward player
  fireStart: number;        // ts when beam started
  nextAttack: number;       // ts when next warning phase begins
  flash: number;            // ts of last hit-flash (for visual feedback)
  faceAngle: number;        // current smooth visual facing angle
  orbitAngle: number;       // current angle on orbit circle around planet
  isTopBomber?: boolean;    // wave 2: hovers at top and drops asteroids
  lastBomb: number;         // ts of last asteroid drop
}

export interface ScorePopup {
  id: number; x: number; y: number; value: number; life: number; color: string;
}

export interface Asteroid {
  id: number; x: number; y: number; vx: number; vy: number;
  radius: number; sprite: number; rotation: number; rotSpeed: number;
  hp: number; maxHP: number; asteroidType: AsteroidType;
  isBoss?: boolean; bossHP?: number; bossMaxHP?: number; bossFlash?: number;
  bossDmg?: number; bossDmgMax?: number; bossPhaseTime?: number;
  isRain?: boolean;
  growEnd?: number; growVx?: number; growVy?: number;
  isOrbiting?: boolean; orbitAngle?: number; orbitRadius?: number; orbitSpeed?: number;
  spiralLerp?: number;  // 0=in line, 1=on spiral path
}

export interface Particle {
  id: number; x: number; y: number; vx: number; vy: number; life: number; color: string;
}

export type PowerType = "wave" | "shield" | "missile" | "heal" | "immortality";

export type SpecialWeapon = "nuke" | "wave" | "plasma" | "cross" | "chain" | "disc" | "magnet";

export interface ChargedPlasma {
  id: number; x: number; y: number; angle: number;
  width: number; length: number;
  damage: number; startTime: number; duration: number; hit: Set<number>;
}

export interface CrossLaser {
  id: number; x: number; y: number; baseAngle: number;
  startTime: number; duration: number;
  spreads: number[];   // initial spread offsets (radians) for each beam
  hit: Set<number>;
}

export interface ChainLightning {
  id: number;
  startTime: number; duration: number;
  links: { x1: number; y1: number; x2: number; y2: number; jags: { x: number; y: number }[] }[];
}

export interface PlayerDisc {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  outerAngle: number;
  innerAngle: number;
  hit: Set<number>;
  bounces: number;
  startTime: number;
  duration: number;
}

export interface MagnetProjectile {
  id: number;
  x: number; y: number;
  vx: number; vy: number;
  radius: number;
  sprite: number;
  asteroidType: AsteroidType;
  rotation: number;
  rotSpeed: number;
  hit: Set<number>;
  startTime: number;
  duration: number;
  enemyType?: 'fighter' | 'drone';
  held?: boolean;
}

export interface PowerUp {
  id: number; x: number; y: number; vx: number; vy: number; type: PowerType;
}

export interface Satellite {
  id: number; angle: number; targetAngle: number; lastFire: number; shieldActive: boolean;
}

export interface SatBullet {
  id: number; x: number; y: number; vx: number; vy: number;
}

export interface AlienDisc {
  id: number; x: number; y: number; vx: number; vy: number;
  outerAngle: number;   // outer ring rotation (clockwise)
  innerAngle: number;   // inner ring rotation (counter-clockwise)
  hp: number;
  flash: number;        // ts of last hit flash
  growEnd?: number;     // grow-in animation end timestamp
}

export interface DiscShockwave {
  id: number; x: number; y: number;
  radius: number; maxRadius: number;
  startTime: number;
}

export interface Debris {
  id: number; x: number; y: number; vx: number; vy: number;
  radius: number; sprite: number; rotation: number; rotSpeed: number; life: number; asteroidType?: AsteroidType; isMetal?: boolean;
}

export interface GameState {
  playerAngle: number;
  bullets: Bullet[];
  waves: Wave[];
  asteroids: Asteroid[];
  particles: Particle[];
  powerUps: PowerUp[];
  score: number;
  planetHP: number;
  gameOver: boolean;
  level: number;
  wave: 1 | 2 | 3 | 4;
  spiralAngle: number;
  spiralReady: boolean;
  planetX: number;
  planetY: number;
  planetTargetY: number;
  asteroidsToSpawn: number;
  asteroidsSpawned: number;
  asteroidsCleared: number;
  lastSpawn: number;
  startTime: number;
  bulletCount: number;
  destroyedCount: number;
  nextBulletAt: number;
  waveActive: number;
  waveAmmo: number;
  plasmaAmmo: number;
  plasmaCharging: boolean;
  plasmaChargeCount: number;
  plasmaChargeStart: number;
  chargedPlasmas: ChargedPlasma[];
  crossLaserAmmo: number;
  crossLasers: CrossLaser[];
  chainLightningAmmo: number;
  chainLightnings: ChainLightning[];
  discLauncherAmmo: number;
  playerDiscs: PlayerDisc[];
  magnetAmmo: number;
  magnetActive: boolean;
  magnetStart: number;
  magnetCaptured: number[];
  magnetProjectiles: MagnetProjectile[];
  selectedWeapon: SpecialWeapon;
  shieldActive: number;
  shieldHP: number;
  missileCount: number;
  plasmaPulses: PlasmaPulse[];
  planetShield: boolean;
  levelComplete: boolean;
  levelBanner: number;
  lastPowerSpawn: number;
  won: boolean;
  planetStage: number;
  planetFlash: number;
  planetExploded: boolean;
  bossSpawned: boolean;
  bossDefeated: boolean;
  bossDefeatTime: number;
  immortal: boolean;
  immortalExpire: number;
  shipDestroyed: boolean;
  shipExplodeTime: number;
  debris: Debris[];
  scorePopups: ScorePopup[];
  shipColor: 'SilverBlue' | 'BlackRed' | 'Gold' | 'AlienBlue' | 'AlienRed';
  laserColor: 'Blue' | 'Yellow' | 'Orange' | 'Red' | 'Purple' | 'Silver' | 'Gold';
  shipHP: number;              // Body HP (structural integrity)
  shipMaxHP: number;
  armourHP: number;             // Armour HP (extra plating, absorbs after forcefield)
  armourMaxHP: number;
  forceFieldHP: number;         // Forcefield HP (energy shield, absorbs first)
  forceFieldMaxHP: number;
  lastShipHitTime: number;
  showColorMenu: boolean;
  unlockedSkins: Set<string>;
  unlockedPlasma: Set<string>;
  satellites: Satellite[];
  satBullets: SatBullet[];
  multiplier: number;
  comboCount: number;
  hitVolleys: Set<number>;
  alienFighters: AlienFighter[];
  aliensKilled: number;
  aliensToKill: number;
  alienDiscs: AlienDisc[];
  discShockwaves: DiscShockwave[];
  alienDrones: AlienDrone[];
  nextDroneFire: number;    // ts when next drone should start firing
  alienBoss: AlienBoss | null;
  bossDiscs: BossDisc[];
  bumperActive: boolean;       // true while right-click held
  paused: boolean;
  upgradeMenuOpen: boolean;
  upgrades: Upgrades;
  upgradePoints: number;
  killCounts: Record<string, number>;
  shipTargetAngle: number;    // angle ship is moving toward
  draggingShip: boolean;      // true while dragging the ship
  // ── Travel phase (between level 10 → 11) ──
  travelPhase: null | 'departing' | 'traveling' | 'arriving';
  travelStart: number;        // ts when current travel phase began
  travelShipX: number;        // ship X during travel
  travelShipY: number;        // ship Y during travel
  travelDepartX: number;      // ship X at start of departing
  travelDepartY: number;      // ship Y at start of departing
  travelDepartRot: number;    // ship rotation at start of departing
  travelArriveOffset: number;  // bg offset at start of arriving
  travelBgOffset: number;     // vertical scroll offset for background
  travelAsteroids: { id: number; x: number; y: number; vx: number; vy: number; radius: number; rotation: number; rotSpeed: number; sprite: number }[];
  // ── Immortal phase ──
  immortalPhase: null | 'departing' | 'active' | 'returning';
  immortalStart: number;
  immortalShipX: number;
  immortalShipY: number;
  immortalDepartX: number;
  immortalDepartY: number;
  immortalDepartRot: number;
  immortalWave: 1 | 2 | 3;
  immortalWaveStart: number;
  immortalBoss: boolean;
  immortalSavedWave: 1 | 2 | 3 | 4;
  immortalSavedAsteroids: Asteroid[];
  immortalSavedPlanetY: number;
  immortalAutoFireLast: number;
  immortalSpiralAngle: number;
  immortalSpiralCenterY: number;
  // ── Game mode ──
  modeConfig: GameModeConfig | null;
  elapsedMs: number;            // running timer for time attack (ms)
  checkpointLevel: number;      // last checkpoint reached (multiple of 10)
}

export interface Upgrades {
  thrusterLevel: number;          // 1-10: ship movement speed
  blasterLevel: number;           // 1-10: adds extra laser barrels
  homingLevel: number;            // 1-10: bullet homing strength  
  fireRateLevel: number;          // 1-10: fire rate
  nukeLevel: number;              // 1-10
  waveLevel: number;              // 1-10
  plasmaLevel: number;            // 1-10
  crossLevel: number;             // 1-10
  chainLevel: number;             // 1-10
  discLevel: number;              // 1-10
  magnetLevel: number;            // 1-10
  shieldLevel: number;            // 1-10: force field, +25 HP per level
  hullPlatingLevel: number;       // 1-10: satellite hull plating
  forceFieldLevel: number;        // 1-10: satellite force field
}

export interface LevelConfig {
  asteroids: number;
  spawnDelay: number;
  maxOnScreen: number;
  speedMult: number;
  boss?: { hp: number; radius: number };
}

// ── Game Modes ───────────────────────────────────────────────────────
export type GameModeId = 'arcade' | 'survival' | 'timeAttack' | 'bossRush' | 'infinity';

export interface GameModeConfig {
  mode: GameModeId;
  permadeath: boolean;       // run ends on death (survival, boss rush, infinity)
  timed: boolean;            // show timer (time attack)
  maxLevel: number;          // 1000 for arcade/survival/timeAttack, Infinity for infinity
  checkpointEvery: number;   // save checkpoint every N levels (10)
  startLevel: number;        // starting level (from range picker or 1)
  endLevel: number;          // ending level (from range picker or maxLevel)
  bossOnly: boolean;         // only boss fights (boss rush)
}
