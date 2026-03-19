import { API_BASE } from "../config/api";
import type { Upgrades } from "../app/game/_shared/types";

// ── Response Types ──────────────────────────────────────────────

export interface GameSession {
  sessionId: number;
  playerId: number;
  score: number;
  level: number;
  upgrades: Upgrades;
  unlockedSkins: string[];
  unlockedPlasma: string[];
  satelliteCount: number;
  shipColor: string;
  laserColor: string;
  highestLevel: number;
  upgradePoints: number;
  killCounts: Record<string, number>;
}

export interface LeaderboardEntry {
  score: number;
  level: number;
  name: string;
  created_at: string;
}

export interface GameConfig {
  upgradeLevelCosts: Record<string, number>;
  buyCosts: Record<string, number>;
  skinCosts: Record<string, number>;
  plasmaCost: number;
  satelliteCost: number;
  satelliteSell: number;
  maxSatellites: number;
  maxUpgradeLevel: number;
  asteroidPoints: Record<string, number>;
  bossAsteroidPoints: number;
  alienPoints: number;
  dronePoints: number;
  discPoints: number;
  bossAlienPoints: number;
  multiplierTiers: [number, number][];
  powerUpEffects: {
    waveAmmoGrant: number;
    waveAmmoMax: number;
    missileGrant: number;
    missileMax: number;
    shieldDuration: number;
    immortalityDuration: number;
    immortalityChance: number;
  };
  alienHP: number;
  droneHP: number;
  discHP: number;
  bossAlienHP: number;
  bossDiscHP: number;
  shipDamage: number;
  shipDamageCooldown: number;
  shipBaseHP: number;
  levelSpeedTiers: number[];
}

// ── Helper ──────────────────────────────────────────────────────

async function post<T>(path: string, body: Record<string, unknown>): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Request failed");
  }
  return res.json();
}

// ── Session ─────────────────────────────────────────────────────

export async function startNewGame(playerName = "Player"): Promise<GameSession> {
  return post("/api/game/new", { player_name: playerName });
}

export async function getSession(sessionId: number): Promise<GameSession> {
  return get(`/api/game/session/${sessionId}`);
}

export async function syncGame(sessionId: number, score: number, level: number): Promise<GameSession> {
  return post("/api/game/sync", { session_id: sessionId, score, level });
}

// ── Score ────────────────────────────────────────────────────────

export async function submitScore(
  sessionId: number, score: number, level: number,
  killCounts: Record<string, number> = {},
): Promise<GameSession & { submitted: boolean }> {
  return post("/api/game/submit-score", { session_id: sessionId, score, level, kill_counts: killCounts });
}

export async function getLeaderboard(limit = 10): Promise<{ entries: LeaderboardEntry[] }> {
  return get(`/api/game/leaderboard?limit=${limit}`);
}

// ── Upgrades ────────────────────────────────────────────────────

export async function buyTech(sessionId: number, key: keyof Upgrades): Promise<GameSession> {
  return post("/api/game/upgrade/buy-tech", { session_id: sessionId, key });
}

export async function sellTech(sessionId: number, key: keyof Upgrades): Promise<GameSession & { refund: number }> {
  return post("/api/game/upgrade/sell-tech", { session_id: sessionId, key });
}

export async function upgradeLevelUp(sessionId: number, key: keyof Upgrades): Promise<GameSession> {
  return post("/api/game/upgrade/level-up", { session_id: sessionId, key });
}

export async function upgradeLevelDown(sessionId: number, key: keyof Upgrades): Promise<GameSession & { refund: number }> {
  return post("/api/game/upgrade/level-down", { session_id: sessionId, key });
}

// ── Unlocks ─────────────────────────────────────────────────────

export async function buySkin(sessionId: number, skin: string): Promise<GameSession> {
  return post("/api/game/unlock/skin", { session_id: sessionId, skin });
}

export async function buyPlasma(sessionId: number, color: string): Promise<GameSession> {
  return post("/api/game/unlock/plasma", { session_id: sessionId, color });
}

// ── Satellites ──────────────────────────────────────────────────

export async function buySatellite(sessionId: number): Promise<GameSession> {
  return post("/api/game/satellite/buy", { session_id: sessionId });
}

export async function sellSatellite(sessionId: number): Promise<GameSession & { refund: number }> {
  return post("/api/game/satellite/sell", { session_id: sessionId });
}

// ── Cosmetics ───────────────────────────────────────────────────

export async function setShipColor(sessionId: number, color: string): Promise<GameSession> {
  return post("/api/game/set-ship-color", { session_id: sessionId, color });
}

export async function setLaserColor(sessionId: number, color: string): Promise<GameSession> {
  return post("/api/game/set-laser-color", { session_id: sessionId, color });
}

// ── Level Progression ───────────────────────────────────────────

export async function levelComplete(
  sessionId: number, level: number, score: number,
  killCounts: Record<string, number> = {},
): Promise<GameSession> {
  return post("/api/game/level-complete", { session_id: sessionId, level, score, kill_counts: killCounts });
}

// ── Config ──────────────────────────────────────────────────────

export async function getGameConfig(): Promise<GameConfig> {
  return get("/api/game/config");
}
