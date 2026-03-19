import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StatusBar as RNStatusBar,
  PanResponder,
  LayoutChangeEvent,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { router, useLocalSearchParams } from "expo-router";
import { Feather } from "@expo/vector-icons";
import {
  GW, GH, OX, OY, SPACE_BG, MAIN_MENU_BG,
} from "./game/_shared/constants";
import type { GameModeId, GameModeConfig } from "./game/_shared/types";
import { loadProgress, PlayerProgress } from "../services/progressService";

interface ModeInfo {
  id: GameModeId;
  label: string;
  icon: string;
  color: string;
  desc: string;
  locked: boolean;
  lockReason?: string;
  hasRange: boolean;
  permadeath: boolean;
  timed: boolean;
  bossOnly: boolean;
  maxLevel: number;
}

const MODES: ModeInfo[] = [
  {
    id: "arcade", label: "Arcade Mode", icon: "grid", color: "#60a5fa",
    desc: "1000 levels with checkpoints every 10 levels. Die? Restart from your last checkpoint.",
    locked: false, hasRange: false, permadeath: false, timed: false, bossOnly: false, maxLevel: 1000,
  },
  {
    id: "survival", label: "Survival Mode", icon: "heart", color: "#f87171",
    desc: "Permadeath run. Checkpoints let you save & exit, but death ends the run.",
    locked: false, hasRange: true, permadeath: true, timed: false, bossOnly: false, maxLevel: 1000,
  },
  {
    id: "timeAttack", label: "Time Attack", icon: "clock", color: "#facc15",
    desc: "Race against the clock. Your time is tracked down to the millisecond.",
    locked: false, hasRange: true, permadeath: false, timed: true, bossOnly: false, maxLevel: 1000,
  },
  {
    id: "bossRush", label: "Boss Rush", icon: "zap", color: "#c084fc",
    desc: "111 bosses, one after another. Permadeath. How far can you get?",
    locked: false, hasRange: true, permadeath: true, timed: false, bossOnly: true, maxLevel: 111,
  },
  {
    id: "infinity", label: "Infinity Mode", icon: "repeat", color: "#34d399",
    desc: "No end. Permadeath. Checkpoints every 10 levels. Go as far as you can.",
    locked: false, hasRange: false, permadeath: true, timed: false, bossOnly: false, maxLevel: Infinity,
  },
];

/* ── Dual-thumb range slider ─────────────────────────────────────── */
const THUMB_R = 14;
const TRACK_H = 6;
const SLIDER_PAD = THUMB_R; // padding so thumbs don't clip

function RangeSlider({
  min, max, low, high, color, onChangeStart, onChangeEnd,
}: {
  min: number; max: number; low: number; high: number; color: string;
  onChangeStart: (v: number) => void; onChangeEnd: (v: number) => void;
}) {
  const trackW = useRef(0);
  const [, forceRender] = useState(0);
  const grabX = useRef(0); // x position at drag start

  const valToX = useCallback((v: number) => {
    if (max <= min) return 0;
    return ((v - min) / (max - min)) * trackW.current;
  }, [min, max]);

  const xToVal = useCallback((x: number) => {
    if (trackW.current <= 0 || max <= min) return min;
    const ratio = Math.max(0, Math.min(1, x / trackW.current));
    return Math.round(min + ratio * (max - min));
  }, [min, max]);

  const onLayout = (e: LayoutChangeEvent) => {
    trackW.current = e.nativeEvent.layout.width;
    forceRender(n => n + 1);
  };

  const lowRef = useRef(low);
  const highRef = useRef(high);
  lowRef.current = low;
  highRef.current = high;

  const lowPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        grabX.current = ((lowRef.current - min) / (max - min)) * trackW.current;
      },
      onPanResponderMove: (_e, gs) => {
        const newX = grabX.current + gs.dx;
        const val = Math.max(min, Math.min(highRef.current, Math.round(min + (Math.max(0, Math.min(1, newX / trackW.current))) * (max - min))));
        onChangeStart(val);
      },
    })
  ).current;

  const highPan = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: () => {
        grabX.current = ((highRef.current - min) / (max - min)) * trackW.current;
      },
      onPanResponderMove: (_e, gs) => {
        const newX = grabX.current + gs.dx;
        const val = Math.max(lowRef.current, Math.min(max, Math.round(min + (Math.max(0, Math.min(1, newX / trackW.current))) * (max - min))));
        onChangeEnd(val);
      },
    })
  ).current;

  const lowX = valToX(low);
  const highX = valToX(high);

  return (
    <View style={{ paddingHorizontal: SLIDER_PAD }}>
      {/* Level labels above */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginBottom: 8 }}>
        <Text style={{ color: color, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {low}
        </Text>
        <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12, alignSelf: "center" }}>
          ─── Level Range ───
        </Text>
        <Text style={{ color: color, fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"] }}>
          {high}
        </Text>
      </View>

      {/* Track */}
      <View
        onLayout={onLayout}
        style={{
          height: THUMB_R * 2 + 8,
          justifyContent: "center",
        }}
      >
        {/* Background track */}
        <View style={{
          height: TRACK_H, borderRadius: TRACK_H / 2,
          backgroundColor: "rgba(255,255,255,0.12)",
        }} />

        {/* Active range fill */}
        <View style={{
          position: "absolute",
          left: lowX, width: Math.max(0, highX - lowX),
          height: TRACK_H, borderRadius: TRACK_H / 2,
          backgroundColor: color + "80",
        }} />

        {/* Low thumb */}
        <View
          {...lowPan.panHandlers}
          style={{
            position: "absolute",
            left: lowX - THUMB_R,
            width: THUMB_R * 2, height: THUMB_R * 2,
            borderRadius: THUMB_R,
            backgroundColor: color,
            borderWidth: 3, borderColor: "#fff",
            shadowColor: color, shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6, shadowRadius: 8,
            elevation: 6,
          }}
        />

        {/* High thumb */}
        <View
          {...highPan.panHandlers}
          style={{
            position: "absolute",
            left: highX - THUMB_R,
            width: THUMB_R * 2, height: THUMB_R * 2,
            borderRadius: THUMB_R,
            backgroundColor: color,
            borderWidth: 3, borderColor: "#fff",
            shadowColor: color, shadowOffset: { width: 0, height: 0 },
            shadowOpacity: 0.6, shadowRadius: 8,
            elevation: 6,
          }}
        />
      </View>

      {/* Min / Max labels */}
      <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: 2 }}>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{min}</Text>
        <Text style={{ color: "rgba(255,255,255,0.25)", fontSize: 10 }}>{max}</Text>
      </View>
    </View>
  );
}

/* ── Mode screen ─────────────────────────────────────────────────── */

export default function ModeSelect() {
  const { mode: modeParam, devMode: devParam } = useLocalSearchParams<{ mode?: string; devMode?: string }>();
  const isDev = devParam === "true";
  const [rangeStart, setRangeStart] = useState(1);
  const [rangeEnd, setRangeEnd] = useState(1000);
  const [progress, setProgress] = useState<PlayerProgress>({ highestCheckpoint: 0, defeatedBosses: [], completedLevel1000: false });

  const modeInfo = MODES.find(m => m.id === modeParam) ?? null;

  // Load player progress
  useEffect(() => {
    loadProgress().then(setProgress);
  }, []);

  // Compute maximum allowed range based on mode + devMode + progress
  const getCap = () => {
    if (!modeInfo) return 1000;
    if (isDev) return modeInfo.maxLevel === Infinity ? 1000 : modeInfo.maxLevel;
    if (modeInfo.id === "survival" || modeInfo.id === "timeAttack") {
      return Math.max(10, progress.highestCheckpoint); // at least 10 (must have unlocked to reach here)
    }
    if (modeInfo.id === "bossRush") {
      return Math.max(1, progress.defeatedBosses.length);
    }
    return modeInfo.maxLevel === Infinity ? 1000 : modeInfo.maxLevel;
  };

  // Reset range when mode changes or progress loads
  useEffect(() => {
    if (modeInfo?.hasRange) {
      const cap = getCap();
      setRangeStart(1);
      setRangeEnd(cap);
    }
  }, [modeParam, progress, isDev]);

  const startGame = () => {
    if (!modeInfo) return;
    const config: GameModeConfig = {
      mode: modeInfo.id,
      permadeath: modeInfo.permadeath,
      timed: modeInfo.timed,
      maxLevel: modeInfo.maxLevel,
      checkpointEvery: 10,
      startLevel: modeInfo.hasRange ? rangeStart : 1,
      endLevel: modeInfo.hasRange ? rangeEnd : (modeInfo.maxLevel === Infinity ? 0 : modeInfo.maxLevel),
      bossOnly: modeInfo.bossOnly,
    };
    router.push({
      pathname: "/game",
      params: { modeConfig: JSON.stringify(config) },
    });
  };

  // For modes without a range picker, start the game immediately
  useEffect(() => {
    if (modeInfo && !modeInfo.hasRange) {
      startGame();
    }
  }, [modeParam]);

  // If no mode or mode has no range, show nothing (will navigate away)
  if (!modeInfo || !modeInfo.hasRange) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000" }}>
        <StatusBar style="light" />
        <RNStatusBar hidden />
      </View>
    );
  }

  const cap = getCap();

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
        <Image source={SPACE_BG} style={{ position: "absolute", width: GW, height: GH }} resizeMode="cover" />
        <Image source={MAIN_MENU_BG} style={{ position: "absolute", width: GW, height: GH }} resizeMode="cover" />

        <View style={{ flex: 1, justifyContent: "center", paddingHorizontal: 28 }}>
          {/* Back button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={{ position: "absolute", top: 20, left: 20, zIndex: 10 }}
          >
            <Feather name="arrow-left" size={28} color="#fff" />
          </TouchableOpacity>

          {/* Mode icon + title */}
          <View style={{ alignItems: "center", marginBottom: 12 }}>
            <View style={{
              width: 56, height: 56, borderRadius: 28,
              backgroundColor: modeInfo.color + "20",
              borderWidth: 2, borderColor: modeInfo.color + "60",
              alignItems: "center", justifyContent: "center", marginBottom: 12,
            }}>
              <Feather name={modeInfo.icon as any} size={26} color={modeInfo.color} />
            </View>
            <Text style={{
              color: "#fff", fontSize: 24, fontWeight: "900",
              letterSpacing: 2, textAlign: "center",
            }}>
              {modeInfo.label.toUpperCase()}
            </Text>
            <Text style={{
              color: "rgba(255,255,255,0.45)", fontSize: 12,
              textAlign: "center", marginTop: 6, lineHeight: 18, paddingHorizontal: 10,
            }}>
              {modeInfo.desc}
            </Text>
            {modeInfo.permadeath && (
              <View style={{
                backgroundColor: "rgba(248,113,113,0.15)",
                borderRadius: 4, paddingHorizontal: 8, paddingVertical: 3, marginTop: 8,
              }}>
                <Text style={{ color: "#f87171", fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>PERMADEATH</Text>
              </View>
            )}
          </View>

          {/* Range slider */}
          <View style={{ marginTop: 20, marginBottom: 32 }}>
            <RangeSlider
              min={1}
              max={cap}
              low={rangeStart}
              high={rangeEnd}
              color={modeInfo.color}
              onChangeStart={setRangeStart}
              onChangeEnd={setRangeEnd}
            />
          </View>

          {/* Buttons */}
          <View style={{ gap: 12 }}>
            <TouchableOpacity
              onPress={startGame}
              activeOpacity={0.7}
              style={{
                paddingVertical: 16, borderRadius: 14,
                backgroundColor: modeInfo.color + "25",
                borderWidth: 2, borderColor: modeInfo.color + "80",
                alignItems: "center",
                shadowColor: modeInfo.color,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.3, shadowRadius: 12,
              }}
            >
              <Text style={{
                color: modeInfo.color, fontSize: 18, fontWeight: "900", letterSpacing: 3,
              }}>
                START
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => router.back()}
              activeOpacity={0.7}
              style={{
                paddingVertical: 12, borderRadius: 12,
                borderWidth: 1, borderColor: "rgba(255,255,255,0.2)",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 14, fontWeight: "600", letterSpacing: 1 }}>
                BACK
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </View>
  );
}
