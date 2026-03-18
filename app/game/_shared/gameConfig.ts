// Server-authoritative game configuration.
// Populated with defaults, then overwritten by /api/game/config on startup.

export const gameConfig = {
  // ── Points ──
  asteroidPoints: { brown: 25, blue: 75, red: 200, crystal: 500 } as Record<string, number>,
  bossAsteroidPoints: 1000,
  alienPoints: 500,
  dronePoints: 300,
  discPoints: 200,
  bossAlienPoints: 5000,

  // ── Multiplier ──
  multiplierTiers: [
    { hits: 10, mult: 2 },
    { hits: 30, mult: 4 },
    { hits: 70, mult: 8 },
    { hits: 150, mult: 16 },
  ],

  // ── Upgrade costs ──
  upgradeLevelCosts: {
    1: 0, 2: 25_000, 3: 50_000, 4: 75_000, 5: 100_000,
    6: 200_000, 7: 500_000, 8: 1_000_000, 9: 5_000_000, 10: 10_000_000,
  } as Record<number, number>,
  buyCosts: {
    thrusterLevel: 50_000,
    fireRateLevel: 75_000,
    homingLevel: 100_000,
    plasmaLevel: 200_000,
    crossLevel: 200_000,
    magnetLevel: 300_000,
    chainLevel: 500_000,
    discLevel: 500_000,
    shieldLevel: 50_000,
  } as Record<string, number>,

  // ── Skins & plasma ──
  skinCosts: {
    SilverBlue: 0,
    BlackRed: 500_000,
    Gold: 1_000_000,
    AlienBlue: 2_000_000,
    AlienRed: 2_000_000,
  } as Record<string, number>,
  plasmaCost: 10_000_000,

  // ── Satellites ──
  satelliteCost: 1_000_000,
  satelliteSell: 500_000,
  maxSatellites: 3,

  // ── Upgrade limits ──
  maxUpgradeLevel: 10,

  // ── Power-ups ──
  powerUpEffects: {
    waveAmmoGrant: 5,
    waveAmmoMax: 200,
    missileGrant: 1,
    missileMax: 99,
    shieldDuration: 30_000,
    immortalityDuration: 30_000,
    immortalityChance: 0.01,
  },

  // ── Immortal phase ──
  immortalDuration: 30_000,
  immortalDepartDur: 2000,
  immortalReturnDur: 2000,
  immortalWaveDurations: [10_000, 10_000, 10_000],
  immortalAutoFireCD: 120,

  // ── Entity HP ──
  alienHP: 5,
  droneHP: 2,
  discHP: 2,
  bossAlienHP: 80,
  bossDiscHP: 3,

  // ── Ship ──
  shipDamage: 25,
  shipDamageCooldown: 500,
  shipBaseHP: 25,

  // ── Level config ──
  levelSpeedTiers: [1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8, 2.0],
};

/** Apply server config response onto the mutable gameConfig object */
export function applyServerConfig(cfg: Record<string, any>): void {
  if (cfg.asteroidPoints) gameConfig.asteroidPoints = cfg.asteroidPoints;
  if (cfg.bossAsteroidPoints != null) gameConfig.bossAsteroidPoints = cfg.bossAsteroidPoints;
  if (cfg.alienPoints != null) gameConfig.alienPoints = cfg.alienPoints;
  if (cfg.dronePoints != null) gameConfig.dronePoints = cfg.dronePoints;
  if (cfg.discPoints != null) gameConfig.discPoints = cfg.discPoints;
  if (cfg.bossAlienPoints != null) gameConfig.bossAlienPoints = cfg.bossAlienPoints;
  if (cfg.multiplierTiers) {
    gameConfig.multiplierTiers = cfg.multiplierTiers
      .map((t: [number, number]) => ({ hits: t[0], mult: t[1] }))
      .sort((a: { hits: number }, b: { hits: number }) => a.hits - b.hits);
  }
  if (cfg.upgradeLevelCosts) gameConfig.upgradeLevelCosts = cfg.upgradeLevelCosts;
  if (cfg.buyCosts) gameConfig.buyCosts = cfg.buyCosts;
  if (cfg.skinCosts) gameConfig.skinCosts = cfg.skinCosts;
  if (cfg.plasmaCost != null) gameConfig.plasmaCost = cfg.plasmaCost;
  if (cfg.satelliteCost != null) gameConfig.satelliteCost = cfg.satelliteCost;
  if (cfg.satelliteSell != null) gameConfig.satelliteSell = cfg.satelliteSell;
  if (cfg.maxSatellites != null) gameConfig.maxSatellites = cfg.maxSatellites;
  if (cfg.maxUpgradeLevel != null) gameConfig.maxUpgradeLevel = cfg.maxUpgradeLevel;
  if (cfg.powerUpEffects) Object.assign(gameConfig.powerUpEffects, cfg.powerUpEffects);
  if (cfg.alienHP != null) gameConfig.alienHP = cfg.alienHP;
  if (cfg.droneHP != null) gameConfig.droneHP = cfg.droneHP;
  if (cfg.discHP != null) gameConfig.discHP = cfg.discHP;
  if (cfg.bossAlienHP != null) gameConfig.bossAlienHP = cfg.bossAlienHP;
  if (cfg.bossDiscHP != null) gameConfig.bossDiscHP = cfg.bossDiscHP;
  if (cfg.shipDamage != null) gameConfig.shipDamage = cfg.shipDamage;
  if (cfg.shipDamageCooldown != null) gameConfig.shipDamageCooldown = cfg.shipDamageCooldown;
  if (cfg.shipBaseHP != null) gameConfig.shipBaseHP = cfg.shipBaseHP;
  if (cfg.levelSpeedTiers) gameConfig.levelSpeedTiers = cfg.levelSpeedTiers;
}
