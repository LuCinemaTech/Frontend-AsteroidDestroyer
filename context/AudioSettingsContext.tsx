import React, { createContext, useContext, useState, useCallback, useRef } from "react";

interface AudioSettings {
  musicVolume: number;
  sfxVolume: number;
  setMusicVolume: (v: number) => void;
  setSfxVolume: (v: number) => void;
  stopCurrentMusic: () => Promise<void>;
  registerMusic: (stop: () => Promise<void>) => void;
}

const AudioSettingsContext = createContext<AudioSettings>({
  musicVolume: 0.05,
  sfxVolume: 0.5,
  setMusicVolume: () => {},
  setSfxVolume: () => {},
  stopCurrentMusic: async () => {},
  registerMusic: () => {},
});

export function AudioSettingsProvider({ children }: { children: React.ReactNode }) {
  const [musicVolume, setMusicVolumeRaw] = useState(0.05);
  const [sfxVolume, setSfxVolumeRaw] = useState(0.5);
  const currentStopRef = useRef<(() => Promise<void>) | null>(null);

  const setMusicVolume = useCallback((v: number) => {
    setMusicVolumeRaw(Math.max(0, Math.min(1, v)));
  }, []);

  const setSfxVolume = useCallback((v: number) => {
    setSfxVolumeRaw(Math.max(0, Math.min(1, v)));
  }, []);

  const stopCurrentMusic = useCallback(async () => {
    if (currentStopRef.current) {
      const stop = currentStopRef.current;
      currentStopRef.current = null;
      try { await stop(); } catch {}
    }
  }, []);

  const registerMusic = useCallback((stop: () => Promise<void>) => {
    currentStopRef.current = stop;
  }, []);

  return (
    <AudioSettingsContext.Provider
      value={{ musicVolume, sfxVolume, setMusicVolume, setSfxVolume, stopCurrentMusic, registerMusic }}
    >
      {children}
    </AudioSettingsContext.Provider>
  );
}

export function useAudioSettings() {
  return useContext(AudioSettingsContext);
}
