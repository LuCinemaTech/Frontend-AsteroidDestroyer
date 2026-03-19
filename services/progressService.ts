import AsyncStorage from "@react-native-async-storage/async-storage";

const PROGRESS_KEY = "asteroid_destroyer_progress";

export interface PlayerProgress {
  highestCheckpoint: number;   // 0, 10, 20, ... up to 1000
  defeatedBosses: number[];    // level numbers where bosses were beaten (10, 20, 30, ...)
  completedLevel1000: boolean;
}

const DEFAULT_PROGRESS: PlayerProgress = {
  highestCheckpoint: 0,
  defeatedBosses: [],
  completedLevel1000: false,
};

export async function loadProgress(): Promise<PlayerProgress> {
  try {
    const raw = await AsyncStorage.getItem(PROGRESS_KEY);
    if (!raw) return { ...DEFAULT_PROGRESS };
    const parsed = JSON.parse(raw);
    return {
      highestCheckpoint: parsed.highestCheckpoint ?? 0,
      defeatedBosses: Array.isArray(parsed.defeatedBosses) ? parsed.defeatedBosses : [],
      completedLevel1000: !!parsed.completedLevel1000,
    };
  } catch {
    return { ...DEFAULT_PROGRESS };
  }
}

export async function saveProgress(progress: PlayerProgress): Promise<void> {
  try {
    await AsyncStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
  } catch {
    // silent fail
  }
}

/** Record reaching a checkpoint (level divisible by 10). Only updates if higher. */
export async function recordCheckpoint(level: number): Promise<void> {
  const p = await loadProgress();
  if (level > p.highestCheckpoint) {
    p.highestCheckpoint = level;
    if (level >= 1000) p.completedLevel1000 = true;
    await saveProgress(p);
  }
}

/** Record defeating a boss at a given level. */
export async function recordBossDefeat(level: number): Promise<void> {
  const p = await loadProgress();
  if (!p.defeatedBosses.includes(level)) {
    p.defeatedBosses.push(level);
    p.defeatedBosses.sort((a, b) => a - b);
    await saveProgress(p);
  }
}
