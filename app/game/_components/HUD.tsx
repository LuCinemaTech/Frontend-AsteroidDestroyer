import React, { useMemo } from "react";
import { View, Image, Text, TouchableOpacity } from "react-native";
import { GW, GH, POWER_ICONS, PLASMA_COLORS } from "../_shared/constants";
import { max, min, getMultiplierColor } from "../_shared/helpers";
import type { SpecialWeapon } from "../_shared/types";

// ── HUD render (score, power-up icons, level banner, weapon selector) ──

const TOP_BAR_H = 38;
const DOT_SIZE = 8;
const DOT_GAP = 6;
const SELECTED_ICON_SIZE = 26;

/* ── Flip-card digit ─────────────────────────────────────────────── */
function FlipDigit({ ch, glow, wide }: { ch: string; glow?: string; wide?: boolean }) {
  return (
    <View style={{
      width: wide ? 28 : 18, height: 26, marginHorizontal: 1,
      backgroundColor: "#1a1a2e",
      borderRadius: 3,
      justifyContent: "center", alignItems: "center",
      overflow: "hidden",
    }}>
      <Text style={{
        color: glow || "#e0e0e0",
        fontSize: wide ? 13 : 16, fontWeight: "bold",
        fontVariant: ["tabular-nums"],
        textShadowColor: glow || "transparent",
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: glow ? 6 : 0,
      }}>
        {ch}
      </Text>
    </View>
  );
}

interface HUDProps {
  score: number;
  level: number;
  wave: 1 | 2 | 3 | 4;
  shieldActive: number;
  immortal: boolean;
  planetShield: boolean;
  missileCount: number;
  waveAmmo: number;
  plasmaAmmo: number;
  plasmaCharging: boolean;
  plasmaChargeCount: number;
  crossLaserAmmo: number;
  chainLightningAmmo: number;
  discLauncherAmmo: number;
  magnetAmmo: number;
  magnetActive: boolean;
  magnetCapturedCount: number;
  selectedWeapon: SpecialWeapon;
  forceFieldHP: number;
  forceFieldMaxHP: number;
  laserColor: string;
  bannerOpacity: number;
  levelBannerTime: number;
  startTime: number;
  ts: number;
  multiplier: number;
  travelPhase: string | null;
  immortalPhase?: string | null;
  immortalWave?: 1 | 2 | 3;
  timed?: boolean;
  elapsedMs?: number;
  onFireSpecial?: () => void;
  onCycleWeapon?: () => void;
}

export default function HUD({
  score, level, wave, shieldActive, immortal,
  planetShield, missileCount, waveAmmo, plasmaAmmo, plasmaCharging, plasmaChargeCount, crossLaserAmmo, chainLightningAmmo, discLauncherAmmo, magnetAmmo, magnetActive, magnetCapturedCount, selectedWeapon,
  forceFieldHP, forceFieldMaxHP, laserColor,
  bannerOpacity, levelBannerTime, startTime, ts, multiplier, travelPhase, immortalPhase, immortalWave, timed, elapsedMs, onFireSpecial, onCycleWeapon,
}: HUDProps) {
  // Timing since banner appeared
  const elapsed = levelBannerTime > 0 ? ts - levelBannerTime : 99999;

  // Black overlay: only on initial game start, fades out over 1.5s
  const isGameStart = levelBannerTime === startTime;
  const blackOverlay = isGameStart ? max(0, 1 - elapsed / 1500) : 0;

  // Level text: fades in from 0.3s to 0.8s, then follows bannerOpacity for fade-out
  const levelFadeIn = min(1, max(0, (elapsed - 300) / 500));
  const levelOpacity = min(levelFadeIn, bannerOpacity);

  // Wave text: fades in from 0.8s to 1.3s, then follows bannerOpacity for fade-out
  const waveFadeIn = min(1, max(0, (elapsed - 800) / 500));
  const waveOpacity = min(waveFadeIn, bannerOpacity);

  const multColor = getMultiplierColor(multiplier, ts);

  // Format elapsed time for time attack
  const timerStr = useMemo(() => {
    if (!timed || elapsedMs == null) return '';
    const totalSec = Math.floor(elapsedMs / 1000);
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    const ms = Math.floor((elapsedMs % 1000) / 10);
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(ms).padStart(2, '0')}`;
  }, [timed, elapsedMs ? Math.floor(elapsedMs / 100) : 0]);

  type WDef = { key: SpecialWeapon; color: string; icon?: any; emoji?: string; label: string; tapFires: boolean };
  const ownedWeapons: WDef[] = useMemo(() => {
    const all: (WDef & { has: boolean })[] = [
      { key: 'nuke', has: missileCount > 0, color: '#ff7675', icon: POWER_ICONS.missile, label: String(missileCount), tapFires: true },
      { key: 'wave', has: waveAmmo > 0, color: '#fdcb6e', icon: POWER_ICONS.wave, label: String(waveAmmo), tapFires: true },
      { key: 'plasma', has: plasmaAmmo > 0, color: '#00ffc8', emoji: '⚡', label: plasmaCharging ? `${plasmaChargeCount}/${plasmaAmmo}` : String(plasmaAmmo), tapFires: false },
      { key: 'cross', has: crossLaserAmmo > 0, color: '#ff9f43', emoji: '✖', label: String(crossLaserAmmo), tapFires: true },
      { key: 'chain', has: chainLightningAmmo > 0, color: '#74b9ff', emoji: '⛓', label: String(chainLightningAmmo), tapFires: true },
      { key: 'disc', has: discLauncherAmmo > 0, color: '#50ff78', emoji: '◉', label: String(discLauncherAmmo), tapFires: true },
      { key: 'magnet', has: magnetAmmo > 0 || magnetActive, color: '#ff4757', emoji: '🧲', label: magnetActive ? String(magnetCapturedCount) : String(magnetAmmo), tapFires: false },
    ];
    return all.filter(w => w.has);
  }, [missileCount, waveAmmo, plasmaAmmo, plasmaCharging, plasmaChargeCount, crossLaserAmmo, chainLightningAmmo, discLauncherAmmo, magnetAmmo, magnetActive, magnetCapturedCount]);

  const selectedDef = ownedWeapons.find(w => w.key === selectedWeapon) || ownedWeapons[0];

  // Format score as plain digits (no commas)
  const scoreStr = String(score);

  return (
    <>
      {/* Black fade-in overlay */}
      {blackOverlay > 0 && (
        <View
          pointerEvents="none"
          style={{
            position: "absolute", top: 0, left: 0, width: GW, height: GH,
            backgroundColor: "#000", opacity: blackOverlay, zIndex: 10,
          }}
        />
      )}

      {/* ── Top black bar ── */}
      <View style={{
        position: "absolute", top: 0, left: 0, width: GW, height: TOP_BAR_H,
        backgroundColor: "#000",
        flexDirection: "row", alignItems: "center",
        paddingHorizontal: 6,
        zIndex: 5,
      }}>
        {/* Left: Multiplier card + Score flip cards */}
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1 }}>
          <FlipDigit
            ch={multiplier > 1 ? `x${multiplier}` : ""}
            glow={multiplier > 1 ? multColor : undefined}
            wide
          />
          <View style={{ width: 3 }} />
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            {scoreStr.split("").map((ch, i) => (
              <FlipDigit key={i} ch={ch} glow={multiplier > 1 ? multColor : undefined} />
            ))}
          </View>
        </View>

        {/* Center: Timer (time attack mode) */}
        {timed && timerStr && (
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {timerStr.split('').map((ch, i) => (
              <FlipDigit key={i} ch={ch} glow="#ffd700" />
            ))}
          </View>
        )}

        {/* Right: Active power-ups + Special weapons */}
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
          {/* Active power-up icons */}
          {shieldActive > 0 && (
            <Image source={POWER_ICONS.shield} style={{ width: 20, height: 20 }} />
          )}
          {immortal && (
            <Image source={POWER_ICONS.immortality} style={{ width: 20, height: 20 }} />
          )}
          {planetShield && (
            <Image source={POWER_ICONS.shield} style={{ width: 20, height: 20, tintColor: "#74b9ff" }} />
          )}
          {/* Separator when any power-up is active */}
          {(shieldActive > 0 || immortal || planetShield) && (
            <View style={{ width: 1, height: 20, backgroundColor: "#333" }} />
          )}
          {/* Weapon indicator dots */}
          {ownedWeapons.length > 0 && (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: DOT_GAP }}>
              {/* Dots: red for selected, grey for others */}
              {ownedWeapons.map(w => (
                <View
                  key={w.key}
                  style={{
                    width: DOT_SIZE,
                    height: DOT_SIZE,
                    borderRadius: DOT_SIZE / 2,
                    backgroundColor: w.key === selectedDef?.key ? '#ff4444' : '#555',
                  }}
                />
              ))}
              {/* Selected weapon icon + ammo */}
              {selectedDef && (
                <TouchableOpacity
                  onPress={() => { if (selectedDef.tapFires && onFireSpecial) onFireSpecial(); }}
                  activeOpacity={0.7}
                  style={{ flexDirection: 'row', alignItems: 'center', marginLeft: 4 }}
                >
                  {selectedDef.icon
                    ? <Image source={selectedDef.icon} style={{ width: SELECTED_ICON_SIZE, height: SELECTED_ICON_SIZE }} />
                    : <Text style={{ color: selectedDef.color, fontSize: SELECTED_ICON_SIZE - 6, fontWeight: 'bold' }}>{selectedDef.emoji}</Text>
                  }
                  <Text style={{
                    color: selectedDef.color,
                    fontSize: 12, fontWeight: 'bold', marginLeft: 3,
                  }}>
                    {selectedDef.label}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}
        </View>
      </View>

      {/* Level text (wave 1 in normal, or any wave change in immortal) */}
      {!travelPhase && ((wave === 1 && !immortalPhase) || (immortalPhase === 'active' && immortalWave === 1)) && levelOpacity > 0 && (
        <View style={{
          position: "absolute", top: GH * 0.15 - 36, left: 0, right: 0, alignItems: "center",
          opacity: levelOpacity,
        }}>
          <Text style={{ color: immortalPhase ? "#ffd700" : "#ccc", fontSize: 22 }}>
            LEVEL {level}
          </Text>
        </View>
      )}

      {/* Bonus Level text (during travel phase) */}
      {travelPhase && levelOpacity > 0 && (
        <View style={{
          position: "absolute", top: GH * 0.15 - 36, left: 0, right: 0, alignItems: "center",
          opacity: levelOpacity,
        }}>
          <Text style={{ color: "#ffd700", fontSize: 38, fontWeight: "bold" }}>
            BONUS LEVEL
          </Text>
        </View>
      )}

      {/* Wave text (always same position and style) */}
      {!travelPhase && waveOpacity > 0 && (
        <View style={{
          position: "absolute", top: GH * 0.15, left: 0, right: 0, alignItems: "center",
          opacity: waveOpacity,
        }}>
          <Text style={{ color: immortalPhase === 'active'
            ? '#7efaff'
            : wave === 4 ? "#ff6b6b" : "#fff", fontSize: 38, fontWeight: "bold" }}>
            {immortalPhase === 'active'
              ? `Wave ${immortalWave}`
              : wave === 4 ? (level === 10 ? "Boss" : "Mini Boss") : `Wave ${wave}`}
          </Text>
        </View>
      )}

      {/* ── Bottom forcefield bar ── */}
      {forceFieldMaxHP > 0 && (
        <View style={{
          position: "absolute", bottom: 0, left: 0, width: GW, height: 16,
          backgroundColor: "#000",
          flexDirection: "row", alignItems: "center",
          justifyContent: "center",
          paddingHorizontal: 4, gap: 2,
          zIndex: 5,
        }}>
          {(() => {
            const plasmaHex = PLASMA_COLORS[laserColor]?.hex ?? '#7c4dff';
            const segments = forceFieldMaxHP / 25;
            const activeSegments = Math.ceil(forceFieldHP / 25);
            const segmentWidth = (GW - 8 - (segments - 1) * 2) / segments;
            // Build segments: active ones in center, empty ones on edges
            const items = [];
            for (let i = 0; i < segments; i++) {
              // Map from outside-in: leftmost = 0, rightmost = segments-1
              // Segments drain from outside edges toward center
              const distFromCenter = Math.abs(i - (segments - 1) / 2);
              const maxDist = (segments - 1) / 2;
              // Higher distFromCenter = removed first (lower priority)
              // active threshold: segments with smallest distFromCenter stay longest
              const priority = maxDist - distFromCenter; // 0 = edge, maxDist = center
              const isActive = priority < activeSegments;
              items.push(
                <View
                  key={i}
                  style={{
                    width: segmentWidth, height: 8,
                    borderRadius: 2,
                    backgroundColor: isActive ? plasmaHex : 'rgba(255,255,255,0.08)',
                    opacity: isActive ? 1 : 0.4,
                  }}
                />
              );
            }
            return items;
          })()}
        </View>
      )}

    </>
  );
}
