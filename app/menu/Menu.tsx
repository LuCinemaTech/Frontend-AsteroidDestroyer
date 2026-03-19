import React, { useRef, useEffect, useCallback, useState } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  Platform,
  Alert,
  BackHandler,
  TouchableOpacity,
  Pressable,
  StatusBar as RNStatusBar,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router } from "expo-router";
import { Audio } from "expo-av";
import { Feather } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useAudioSettings } from "../../context/AudioSettingsContext";
import { supabase } from "../../config/supabase";
import AnimatedMenuButton from "./_components/Controls";
import { loadProgress, PlayerProgress } from "../../services/progressService";
import {
  GW, GH, OX, OY, STARS, SPACE_BG, MAIN_MENU_BG,
} from "../game/_shared/constants";

const MODE_BUTTONS: { id: string; label: string; icon: string; color: string }[] = [
  { id: "arcade", label: "Arcade", icon: "grid", color: "#60a5fa" },
  { id: "survival", label: "Survival", icon: "heart", color: "#f87171" },
  { id: "timeAttack", label: "Time Attack", icon: "clock", color: "#facc15" },
  { id: "bossRush", label: "Boss Rush", icon: "zap", color: "#c084fc" },
  { id: "infinity", label: "Infinity", icon: "repeat", color: "#34d399" },
];

const MENU_ITEMS: { id: string; label: string; icon: string }[] = [
  { id: "options", label: "Options", icon: "settings" },
  { id: "quit_game", label: "Quit Game", icon: "log-out" },
];

function TwinklingStars() {
  const [, setTick] = useState(0);
  const raf = useRef<number>(0);
  useEffect(() => {
    let running = true;
    const loop = () => {
      if (!running) return;
      setTick(t => t + 1);
      raf.current = requestAnimationFrame(loop);
    };
    raf.current = requestAnimationFrame(loop);
    return () => { running = false; cancelAnimationFrame(raf.current); };
  }, []);
  const now = performance.now();
  return (
    <>
      {STARS.map((st, i) => {
        const t1 = Math.sin(now * st.speed + st.phase);
        const t2 = Math.sin(now * st.speed2 + st.phase2);
        const twinkle = (t1 * 0.6 + t2 * 0.4) * 0.5 + 0.5;
        const opacity = st.o * (0.1 + twinkle * 0.9);
        const r = st.r * (0.9 + twinkle * 0.2);
        return (
          <View
            key={i}
            style={{
              position: "absolute",
              left: st.x + st.r - r,
              top: st.y + st.r - r,
              width: r * 2,
              height: r * 2,
              borderRadius: r,
              backgroundColor: st.c,
              opacity,
            }}
          />
        );
      })}
    </>
  );
}

export default function MainMenu() {
  const titleFade = useRef(new Animated.Value(0)).current;
  const titleScale = useRef(new Animated.Value(0.8)).current;
  const musicRef = useRef<Audio.Sound | null>(null);
  const { musicVolume, stopCurrentMusic, registerMusic } = useAudioSettings();
  const volRef = useRef(musicVolume);
  volRef.current = musicVolume;

  const [user, setUser] = useState<{ username: string; avatarUrl: string | null; isDev: boolean } | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [devMode, setDevMode] = useState(true);
  const [progress, setProgress] = useState<PlayerProgress>({ highestCheckpoint: 0, defeatedBosses: [], completedLevel1000: false });

  // Listen for auth state changes
  useEffect(() => {
    const fetchUser = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser({
          username: session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Player",
          avatarUrl: session.user.user_metadata?.avatar_url || null,
          isDev: !!session.user.user_metadata?.is_dev,
        });
      } else {
        setUser(null);
      }
    };
    fetchUser();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser({
          username: session.user.user_metadata?.username || session.user.email?.split("@")[0] || "Player",
          avatarUrl: session.user.user_metadata?.avatar_url || null,
          isDev: !!session.user.user_metadata?.is_dev,
        });
      } else {
        setUser(null);
      }
      setDropdownOpen(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setDropdownOpen(false);
  };

  // Load player progress each time menu is focused
  useFocusEffect(
    useCallback(() => {
      loadProgress().then(setProgress);
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      let snd: Audio.Sound | null = null;
      (async () => {
        await stopCurrentMusic();
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true });
        const vol = volRef.current;
        const { sound } = await Audio.Sound.createAsync(
          require("../../assets/sounds/music/MenuMusic.mp3"),
          { isLooping: true, volume: vol * vol }
        );
        if (cancelled) { await sound.unloadAsync(); return; }
        snd = sound;
        musicRef.current = sound;
        // Apply latest volume in case it changed during async load
        const latest = volRef.current;
        if (latest !== vol) {
          await sound.setVolumeAsync(latest * latest).catch(() => {});
        }
        registerMusic(async () => {
          if (musicRef.current) {
            const s = musicRef.current;
            musicRef.current = null;
            await s.stopAsync().catch(() => {});
            await s.unloadAsync().catch(() => {});
          }
        });
        await sound.playAsync();
      })();
      return () => {
        cancelled = true;
        if (snd) {
          const s = snd;
          musicRef.current = null;
          s.stopAsync().catch(() => {}).then(() => s.unloadAsync().catch(() => {}));
        }
      };
    }, [])
  );

  useEffect(() => {
    musicRef.current?.setVolumeAsync(musicVolume * musicVolume).catch(() => {});
  }, [musicVolume]);

  useEffect(() => {
    Animated.parallel([
      Animated.timing(titleFade, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(titleScale, {
        toValue: 1,
        friction: 4,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handleModePress = (modeId: string) => {
    router.push({ pathname: "/modes", params: { mode: modeId, devMode: String(devMode) } });
  };

  const handlePress = (id: string) => {
    if (id === "options") {
      router.push("/options");
      return;
    }
    if (id === "quit_game") {
      if (Platform.OS === "web") {
        if (typeof window !== "undefined") window.close();
      } else {
        Alert.alert("Quit Game", "Are you sure?", [
          { text: "Cancel", style: "cancel" },
          { text: "Quit", style: "destructive", onPress: () => BackHandler.exitApp() },
        ]);
      }
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: "#000" }}>
      <StatusBar style="light" />
      <RNStatusBar hidden />
      <View
        style={{
          position: "absolute", left: OX, top: OY,
          width: GW, height: GH, overflow: "hidden",
        }}
      >
        {/* Space background */}
        <Image
          source={SPACE_BG}
          style={{ position: "absolute", width: GW, height: GH }}
          resizeMode="cover"
        />
        {/* Menu overlay image */}
        <Image
          source={MAIN_MENU_BG}
          style={{ position: "absolute", width: GW, height: GH }}
          resizeMode="cover"
        />

        {/* Stars (twinkling like in-game) */}
        <TwinklingStars />

        {/* Content */}
        <View style={{ flex: 1, paddingHorizontal: 24, justifyContent: "center" }}>
          {/* User area (top right) */}
          {!user ? (
            <TouchableOpacity
              onPress={() => router.push("/signin")}
              style={{ position: "absolute", top: 16, right: 16, zIndex: 20 }}
            >
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 14, fontWeight: "600", letterSpacing: 1 }}>
                Sign In
              </Text>
            </TouchableOpacity>
          ) : (
            <View style={{ position: "absolute", top: 12, right: 16, zIndex: 20, alignItems: "flex-end" }}>
              <TouchableOpacity
                onPress={() => setDropdownOpen(!dropdownOpen)}
                style={{ flexDirection: "row", alignItems: "center", gap: 8 }}
              >
                {user.avatarUrl ? (
                  <Image
                    source={{ uri: user.avatarUrl }}
                    style={{ width: 32, height: 32, borderRadius: 16, borderWidth: 2, borderColor: "rgba(255,255,255,0.4)" }}
                  />
                ) : (
                  <View
                    style={{
                      width: 32, height: 32, borderRadius: 16,
                      backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center",
                      borderWidth: 2, borderColor: "rgba(255,255,255,0.4)",
                    }}
                  >
                    <Text style={{ color: "#fff", fontSize: 14, fontWeight: "bold" }}>
                      {user.username.charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <Text style={{ color: "#fff", fontSize: 14, fontWeight: "600" }}>{user.username}</Text>
                <Feather name={dropdownOpen ? "chevron-up" : "chevron-down"} size={16} color="#fff" />
              </TouchableOpacity>

              {/* Dropdown */}
              {dropdownOpen && (
                <View
                  style={{
                    marginTop: 8,
                    backgroundColor: "rgba(20,20,40,0.95)",
                    borderRadius: 10,
                    borderWidth: 1,
                    borderColor: "rgba(255,255,255,0.15)",
                    paddingVertical: 6,
                    minWidth: 180,
                  }}
                >
                  {/* Edit User Image */}
                  <TouchableOpacity
                    onPress={() => { setDropdownOpen(false); /* TODO: navigate to edit image */ }}
                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
                  >
                    {user.avatarUrl ? (
                      <Image
                        source={{ uri: user.avatarUrl }}
                        style={{ width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)" }}
                      />
                    ) : (
                      <View
                        style={{
                          width: 28, height: 28, borderRadius: 14,
                          backgroundColor: "#6366f1", alignItems: "center", justifyContent: "center",
                        }}
                      >
                        <Text style={{ color: "#fff", fontSize: 12, fontWeight: "bold" }}>
                          {user.username.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                    )}
                    <Text style={{ color: "#fff", fontSize: 13 }}>Edit User Image</Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 10 }} />

                  {/* Leaderboards */}
                  <TouchableOpacity
                    onPress={() => { setDropdownOpen(false); /* TODO: navigate to leaderboards */ }}
                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
                  >
                    <Feather name="award" size={18} color="#facc15" />
                    <Text style={{ color: "#fff", fontSize: 13 }}>Leaderboards</Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 10 }} />

                  {/* Edit Details */}
                  <TouchableOpacity
                    onPress={() => { setDropdownOpen(false); /* TODO: navigate to edit details */ }}
                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
                  >
                    <Feather name="edit-3" size={18} color="#60a5fa" />
                    <Text style={{ color: "#fff", fontSize: 13 }}>Edit Details</Text>
                  </TouchableOpacity>

                  <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 10 }} />

                  {/* Sign Out */}
                  <TouchableOpacity
                    onPress={handleSignOut}
                    style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}
                  >
                    <Feather name="log-out" size={18} color="#f87171" />
                    <Text style={{ color: "#f87171", fontSize: 13 }}>Sign Out</Text>
                  </TouchableOpacity>

                  {/* Dev Mode Toggle (dev users only) */}
                  {user.isDev && (
                    <>
                      <View style={{ height: 1, backgroundColor: "rgba(255,255,255,0.1)", marginHorizontal: 10 }} />
                      <View style={{ flexDirection: "row", alignItems: "center", paddingHorizontal: 14, paddingVertical: 10, gap: 10 }}>
                        <Feather name="code" size={18} color={devMode ? "#4ade80" : "#888"} />
                        <Text style={{ color: devMode ? "#4ade80" : "#888", fontSize: 13, flex: 1 }}>
                          {devMode ? "Dev Mode" : "User Mode"}
                        </Text>
                        <Pressable
                          onPress={() => setDevMode(prev => !prev)}
                          style={{
                            width: 44, height: 24, borderRadius: 12,
                            backgroundColor: devMode ? "#4ade80" : "rgba(255,255,255,0.15)",
                            justifyContent: "center",
                            paddingHorizontal: 2,
                          }}
                        >
                          <View style={{
                            width: 20, height: 20, borderRadius: 10,
                            backgroundColor: "#fff",
                            alignSelf: devMode ? "flex-end" : "flex-start",
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.3, shadowRadius: 2,
                          }} />
                        </Pressable>
                      </View>
                    </>
                  )}
                </View>
              )}
            </View>
          )}

          {/* Close dropdown when tapping elsewhere */}
          {dropdownOpen && (
            <Pressable
              onPress={() => setDropdownOpen(false)}
              style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 15 }}
            />
          )}

          {/* Logo section */}
          <View style={{ alignItems: "center" }}>
            <Animated.View
              style={{ marginTop: -40, alignItems: "center", opacity: titleFade, transform: [{ scale: titleScale }] }}
            >
              <Image
                source={require("../../assets/images/Menus/AsteroidDestroyer-Logo.png")}
                style={{ width: GW * 0.9, height: GW * 0.66 }}
                resizeMode="contain"
              />
            </Animated.View>
          </View>

          {/* Mode buttons */}
          <View style={{ alignItems: "center", marginTop: 8 }}>
            <View style={{ width: "100%", maxWidth: 360, gap: 10 }}>
              {MODE_BUTTONS.map((mode, index) => {
                let locked = false;
                let lockLabel: string | undefined;

                if (!devMode) {
                  if (mode.id === "survival" || mode.id === "timeAttack") {
                    if (progress.highestCheckpoint < 10) {
                      locked = true;
                      lockLabel = "Complete checkpoint 10 in Arcade";
                    }
                  } else if (mode.id === "bossRush") {
                    if (progress.defeatedBosses.length === 0) {
                      locked = true;
                      lockLabel = "Defeat a boss in Arcade";
                    }
                  } else if (mode.id === "infinity") {
                    if (!progress.completedLevel1000) {
                      locked = true;
                      lockLabel = "Complete level 1000 in Arcade";
                    }
                  }
                }

                return (
                  <AnimatedMenuButton
                    key={mode.id}
                    item={{ id: mode.id, label: mode.label, icon: mode.icon as any }}
                    index={index}
                    onPress={() => handleModePress(mode.id)}
                    customStyle={{ border: mode.color + "60", accent: mode.color + "18" }}
                    locked={locked}
                    lockLabel={lockLabel}
                  />
                );
              })}
            </View>
          </View>

          {/* Options & Quit */}
          <View style={{ alignItems: "center", marginTop: 12 }}>
            <View style={{ width: "100%", maxWidth: 360, gap: 10 }}>
              {MENU_ITEMS.map((item, index) => (
                <AnimatedMenuButton key={item.id} item={item as any} index={MODE_BUTTONS.length + index} onPress={handlePress} />
              ))}
            </View>
          </View>

          {/* Copyright */}
          <View style={{ alignItems: "center", paddingVertical: 12 }}>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, letterSpacing: 1.5, textAlign: "center" }}>© 2026 Asteroid Destroyer</Text>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, letterSpacing: 1.5, textAlign: "center" }}>Heliomatics</Text>
            <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 11, letterSpacing: 1.5, textAlign: "center" }}>v1.0.0</Text>
          </View>
        </View>
      </View>
    </View>
  );
}
