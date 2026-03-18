import { useEffect, useRef } from "react";
import { Audio } from "expo-av";
import { GAME_MUSIC } from "../_shared/constants";

export function useGameAudio(musicVolume: number, sfxVolume: number) {
  const musicRef = useRef<Audio.Sound | null>(null);
  const laserSfxPool = useRef<Audio.Sound[]>([]);
  const sfxIdx = useRef(0);
  const sfxVolRef = useRef(sfxVolume);
  sfxVolRef.current = sfxVolume;

  // Music setup
  useEffect(() => {
    let snd: Audio.Sound | null = null;
    (async () => {
      try {
        await Audio.setAudioModeAsync({
          playsInSilentModeIOS: true,
          staysActiveInBackground: false,
          shouldDuckAndroid: true,
        });
        const { sound } = await Audio.Sound.createAsync(GAME_MUSIC, {
          isLooping: true,
          volume: musicVolume * musicVolume,
        });
        snd = sound;
        musicRef.current = sound;
        await sound.playAsync();
      } catch { /* ignore */ }
    })();
    return () => { if (snd) snd.unloadAsync().catch(() => {}); };
  }, []);

  useEffect(() => {
    if (musicRef.current) musicRef.current.setVolumeAsync(musicVolume * musicVolume).catch(() => {});
  }, [musicVolume]);

  // SFX preload
  useEffect(() => {
    const pool: Audio.Sound[] = [];
    (async () => {
      for (let i = 0; i < 4; i++) {
        const { sound } = await Audio.Sound.createAsync(
          require("../../../assets/sounds/sfx/Laser-Fire.mp3"),
          { volume: sfxVolRef.current * sfxVolRef.current },
        );
        pool.push(sound);
      }
      laserSfxPool.current = pool;
    })();
    return () => { pool.forEach(s => s.unloadAsync().catch(() => {})); };
  }, []);

  const playLaserSfx = () => {
    const pool = laserSfxPool.current;
    if (pool.length > 0) {
      const snd = pool[sfxIdx.current % pool.length];
      sfxIdx.current++;
      snd.setPositionAsync(0).then(() =>
        snd.setVolumeAsync(sfxVolRef.current * sfxVolRef.current).then(() =>
          snd.playAsync()
        )
      ).catch(() => {});
    }
  };

  return { playLaserSfx };
}
