import React, { useState, useRef, useCallback, useEffect } from "react";
import { View, Text, TouchableOpacity, ScrollView, Image, Pressable, Animated, TextInput, Easing } from "react-native";
import { GW, GH, OX, OY, SHIP_IMAGES, PLASMA_COLORS, STARS } from "../_shared/constants";
import { gameConfig } from "../_shared/gameConfig";
import {
  Canvas,
  Image as SkiaImage,
  Circle,
  Rect,
  LinearGradient,
  vec,
  useImage,
} from "@shopify/react-native-skia";
import type { Upgrades } from "../_shared/types";

type ShipSkin = 'SilverBlue' | 'BlackRed' | 'Gold' | 'AlienBlue' | 'AlienRed';
type PlasmaColor = 'Blue' | 'Yellow' | 'Orange' | 'Red' | 'Purple' | 'Silver' | 'Gold';

interface UpgradeOverlayProps {
  upgrades: Upgrades;
  score: number;
  level: number;
  shipColor: ShipSkin;
  laserColor: PlasmaColor;
  unlockedSkins: Set<string>;
  unlockedPlasma: Set<string>;
  satelliteCount: number;
  onBuyTech: (key: keyof Upgrades) => void;
  onSellTech: (key: keyof Upgrades) => void;
  onUpgrade: (key: keyof Upgrades) => void;
  onSell: (key: keyof Upgrades) => void;
  onBuySkin: (c: ShipSkin) => void;
  onSetShipColor: (c: ShipSkin) => void;
  onSetLaserColor: (c: PlasmaColor) => void;
  onBuyPlasma: (c: PlasmaColor) => void;
  onBuySatellite: () => void;
  onSellSatellite: () => void;
  onLevels: () => void;
  onClose: () => void;
}

type TabItem = { key: keyof Upgrades; label: string; desc: string; color: string; accent: string; buyCost?: number };

type UpgradeTabDef = {
  id: string;
  label: string;
  icon: string;
  color: string;
  group: 'starship' | 'weapons' | 'tech' | 'support';
} & (
  | { kind: 'items'; items: TabItem[] }
  | { kind: 'skins' }
  | { kind: 'plasma' }
  | { kind: 'satellite'; items: TabItem[] }
);

const TABS: UpgradeTabDef[] = [
  // ── Starship ──
  {
    id: "body", label: "Starship Body", icon: "🚀", color: "#74b9ff", group: "starship", kind: "skins",
  },
  {
    id: "engine", label: "Starship Engine", icon: "⚙️", color: "#ffeaa7", group: "starship", kind: "items",
    items: [],
  },
  {
    id: "plasma", label: "Plasma Core", icon: "🔮", color: "#1e90ff", group: "starship", kind: "plasma",
  },
  // ── Weapons ──
  {
    id: "blasters", label: "Blasters", icon: "💥", color: "#74b9ff", group: "weapons", kind: "items",
    items: [
      { key: "blasterLevel", label: "Photon Blasters", desc: "How many lasers fire", color: "#74b9ff", accent: "#0f1a2a" },
      { key: "fireRateLevel", label: "Rapid Fire", desc: "Shots per second", color: "#ffeaa7", accent: "#1a1810" , buyCost: 75_000 },
      { key: "homingLevel", label: "Homing", desc: "Bullet tracking", color: "#a29bfe", accent: "#15132a" , buyCost: 100_000 },
    ],
  },
  {
    id: "archweapons", label: "Arch Weapons", icon: "⚡", color: "#fdcb6e", group: "weapons", kind: "items",
    items: [
      { key: "waveLevel", label: "Arc Wave", desc: "Wave power & range", color: "#fdcb6e", accent: "#1a1610" },
      { key: "nukeLevel", label: "Plasma Nuke", desc: "Blast radius & damage", color: "#ff7675", accent: "#1a1010" },
      { key: "plasmaLevel", label: "Plasma Beam", desc: "Beam intensity", color: "#00ffc8", accent: "#0a1a18", buyCost: 200_000 },
      { key: "crossLevel", label: "Cross Laser", desc: "Beam width & duration", color: "#ff9f43", accent: "#1a1510", buyCost: 200_000 },
      { key: "chainLevel", label: "Chain Lightning", desc: "Arcs & damage", color: "#74b9ff", accent: "#0f1a2a", buyCost: 500_000 },
      { key: "discLevel", label: "Disc Launcher", desc: "Disc count & speed", color: "#50ff78", accent: "#0c1a10", buyCost: 500_000 },
      { key: "magnetLevel", label: "Tractor Beam", desc: "Pull range & strength", color: "#ff4757", accent: "#1a0c10", buyCost: 300_000 },
    ],
  },
  // ── Tech ──
  {
    id: "thrusters", label: "Thrusters", icon: "🔥", color: "#00d2ff", group: "tech", kind: "items",
    items: [
      { key: "thrusterLevel", label: "Movement Speed", desc: "Ship rotation speed", color: "#00d2ff", accent: "#0a151a", buyCost: 50_000 },
    ],
  },
  {
    id: "shields", label: "Shields", icon: "🛡", color: "#00ffc8", group: "tech", kind: "items",
    items: [
      { key: "shieldLevel", label: "Force Field", desc: "+25 FP per level", color: "#00ffc8", accent: "#0a1a18", buyCost: 50_000 },
    ],
  },
  // ── Support ──
  {
    id: "satellite", label: "Satellite Drone", icon: "\uD83D\uDEF0", color: "#a29bfe", group: "support", kind: "satellite",
    items: [
      { key: "hullPlatingLevel", label: "Hull Plating", desc: "Satellite durability", color: "#a29bfe", accent: "#15132a" },
      { key: "forceFieldLevel", label: "Force Field", desc: "Satellite shield", color: "#74b9ff", accent: "#0f1a2a" },
    ],
  },
];

export const BUY_COSTS: Partial<Record<keyof Upgrades, number>> = {};
for (const _tab of TABS) {
  if ('items' in _tab) for (const _it of _tab.items) if (_it.buyCost !== undefined) BUY_COSTS[_it.key] = _it.buyCost;
}

const SKINS: { id: ShipSkin; name: string; color: string }[] = [
  { id: "SilverBlue", name: "Silver Blue", color: "#74b9ff" },
  { id: "BlackRed", name: "Black Red", color: "#ff4757" },
  { id: "Gold", name: "Gold", color: "#ffd700" },
  { id: "AlienBlue", name: "Alien Blue", color: "#00d2ff" },
  { id: "AlienRed", name: "Alien Red", color: "#ff6b6b" },
];

export function getUpgradeCost(currentLevel: number): number {
  if (currentLevel >= gameConfig.maxUpgradeLevel) return Infinity;
  return gameConfig.upgradeLevelCosts[currentLevel + 1] ?? 0;
}

export function getSellValue(currentLevel: number): number {
  return Math.floor((gameConfig.upgradeLevelCosts[currentLevel] ?? 0) / 2);
}

function formatCost(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return String(n);
}

const MAX_LEVEL = gameConfig.maxUpgradeLevel;

function LevelPips({ level, color }: { level: number; color: string }) {
  return (
    <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
      {Array.from({ length: MAX_LEVEL }, (_, i) => (
        <View
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: 2,
            backgroundColor: i < level ? color : "rgba(255,255,255,0.08)",
            ...(i < level ? {
              shadowColor: color,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.6,
              shadowRadius: 3,
            } : {}),
          }}
        />
      ))}
    </View>
  );
}

function SkinSelector({ mode, shipColor, unlockedSkins, score, onSetShipColor, onBuySkin, plasmaHex }: {
  mode: 'trader' | 'terminal';
  shipColor: ShipSkin;
  unlockedSkins: Set<string>;
  score: number;
  onSetShipColor: (c: ShipSkin) => void;
  onBuySkin: (c: ShipSkin) => void;
  plasmaHex: string;
}) {
  const filtered = SKINS.filter(s => mode === 'trader' ? !unlockedSkins.has(s.id) : unlockedSkins.has(s.id));
  if (filtered.length === 0) return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
        {mode === 'trader' ? 'All skins purchased!' : 'No skins owned yet.'}
      </Text>
    </View>
  );
  return (
    <View style={{ gap: 6 }}>
      {filtered.map((skin) => {
        const owned = unlockedSkins.has(skin.id);
        const selected = shipColor === skin.id;
        const canAfford = score >= (gameConfig.skinCosts[skin.id] ?? 0);
        return (
          <View
            key={skin.id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: selected ? `${plasmaHex}45` : `${plasmaHex}30`,
              borderWidth: 1.5,
              borderColor: selected ? `${plasmaHex}aa` : `${plasmaHex}60`,
            }}
          >
            <Image
              source={SHIP_IMAGES[skin.id]}
              style={{ width: 36, height: 54, opacity: owned ? 1 : 0.35 }}
              resizeMode="contain"
            />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{
                color: owned ? (selected ? plasmaHex : "rgba(255,255,255,0.8)") : "rgba(255,255,255,0.55)",
                fontSize: 14,
                fontWeight: "600",
                letterSpacing: 0.3,
              }}>
                {skin.name}
              </Text>
            </View>
            {owned ? (
              selected ? (
                <View style={{
                  backgroundColor: `${plasmaHex}30`,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: `${plasmaHex}60`,
                }}>
                  <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
                    EQUIPPED
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => onSetShipColor(skin.id)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: `${plasmaHex}20`,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: `${plasmaHex}50`,
                  }}
                >
                  <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
                    EQUIP
                  </Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                onPress={() => canAfford && onBuySkin(skin.id)}
                disabled={!canAfford}
                activeOpacity={0.7}
                style={{
                  minWidth: 72,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: canAfford ? `${plasmaHex}80` : "rgba(255,255,255,0.1)",
                  backgroundColor: canAfford ? `${plasmaHex}20` : "rgba(255,255,255,0.03)",
                  alignItems: "center",
                }}
              >
                <Text style={{
                  color: canAfford ? plasmaHex : "rgba(255,255,255,0.25)",
                  fontSize: 11,
                  fontWeight: "700",
                }}>
                  {formatCost(gameConfig.skinCosts[skin.id] ?? 0)}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const PLASMA_CORE_COLORS: PlasmaColor[] = ['Blue', 'Yellow', 'Orange', 'Red', 'Purple', 'Silver', 'Gold'];
const PLASMA_COST = gameConfig.plasmaCost;

function PlasmaSelector({ mode, laserColor, unlockedPlasma, score, onSetLaserColor, onBuyPlasma, plasmaHex }: {
  mode: 'trader' | 'terminal';
  laserColor: PlasmaColor;
  unlockedPlasma: Set<string>;
  score: number;
  onSetLaserColor: (c: PlasmaColor) => void;
  onBuyPlasma: (c: PlasmaColor) => void;
  plasmaHex: string;
}) {
  const filtered = PLASMA_CORE_COLORS.filter(id => mode === 'trader' ? !unlockedPlasma.has(id) : unlockedPlasma.has(id));
  if (filtered.length === 0) return (
    <View style={{ alignItems: "center", paddingVertical: 16 }}>
      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
        {mode === 'trader' ? 'All plasma cores purchased!' : 'No plasma cores owned yet.'}
      </Text>
    </View>
  );
  return (
    <View style={{ gap: 6 }}>
      {filtered.map((id) => {
        const info = PLASMA_COLORS[id];
        const owned = unlockedPlasma.has(id);
        const selected = laserColor === id;
        const canAfford = score >= PLASMA_COST;
        return (
          <View
            key={id}
            style={{
              flexDirection: "row",
              alignItems: "center",
              paddingVertical: 8,
              paddingHorizontal: 12,
              borderRadius: 10,
              backgroundColor: selected ? `${plasmaHex}45` : `${plasmaHex}30`,
              borderWidth: 1.5,
              borderColor: selected ? `${plasmaHex}aa` : `${plasmaHex}60`,
            }}
          >
            {/* Square color swatch */}
            <View style={{
              width: 32, height: 32,
              borderRadius: 6,
              backgroundColor: info.hex,
              opacity: owned ? 1 : 0.35,
            }} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={{
                color: owned ? plasmaHex : "rgba(255,255,255,0.55)",
                fontSize: 14,
                fontWeight: "600",
                letterSpacing: 0.3,
              }}>
                {info.label}
              </Text>
            </View>
            {owned ? (
              selected ? (
                <View style={{
                  backgroundColor: `${plasmaHex}30`,
                  borderRadius: 6,
                  paddingHorizontal: 8,
                  paddingVertical: 3,
                  borderWidth: 1,
                  borderColor: `${plasmaHex}60`,
                }}>
                  <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700", letterSpacing: 1 }}>
                    EQUIPPED
                  </Text>
                </View>
              ) : (
                <TouchableOpacity
                  onPress={() => onSetLaserColor(id)}
                  activeOpacity={0.7}
                  style={{
                    backgroundColor: `${plasmaHex}20`,
                    borderRadius: 6,
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderWidth: 1,
                    borderColor: `${plasmaHex}50`,
                  }}
                >
                  <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 }}>
                    EQUIP
                  </Text>
                </TouchableOpacity>
              )
            ) : (
              <TouchableOpacity
                onPress={() => canAfford && onBuyPlasma(id)}
                disabled={!canAfford}
                activeOpacity={0.7}
                style={{
                  minWidth: 72,
                  paddingHorizontal: 10,
                  paddingVertical: 7,
                  borderRadius: 8,
                  borderWidth: 1,
                  borderColor: canAfford ? `${plasmaHex}80` : "rgba(255,255,255,0.1)",
                  backgroundColor: canAfford ? `${plasmaHex}20` : "rgba(255,255,255,0.03)",
                  alignItems: "center",
                }}
              >
                <Text style={{
                  color: canAfford ? plasmaHex : "rgba(255,255,255,0.25)",
                  fontSize: 11,
                  fontWeight: "700",
                }}>
                  10.0M
                </Text>
              </TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );
}

const SAT_COST = gameConfig.satelliteCost;

/** Skia-driven scrolling space background with twinkling stars (like bonus level) */
function SpaceBgCanvas() {
  const imgBg = useImage(require("../../../assets/images/Menus/Space-Background.png"));
  const [layout, setLayout] = useState({ w: 0, h: 0 });
  const [ts, setTs] = useState(() => performance.now());

  useEffect(() => {
    let id: number;
    const tick = () => { setTs(performance.now()); id = requestAnimationFrame(tick); };
    id = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(id);
  }, []);

  const { w, h } = layout;
  const bgOffset = h > 0 ? (ts * 0.02) % h : 0;
  const FADE = Math.min(h * 0.6, 200);

  return (
    <View
      style={{ position: "absolute", left: 0, right: 0, top: 0, bottom: 0 }}
      onLayout={e => {
        const { width, height } = e.nativeEvent.layout;
        if (width !== layout.w || height !== layout.h) setLayout({ w: width, h: height });
      }}
    >
      {w > 0 && h > 0 && (
        <Canvas style={{ width: w, height: h }}>
          {imgBg && (
            <>
              <SkiaImage image={imgBg} x={0} y={bgOffset} width={w} height={h} fit="cover" />
              <SkiaImage image={imgBg} x={0} y={bgOffset - h} width={w} height={h} fit="cover" />
              {/* Seam fade at the join */}
              <Rect x={0} y={bgOffset - FADE / 2} width={w} height={FADE}>
                <LinearGradient
                  start={vec(0, bgOffset - FADE / 2)}
                  end={vec(0, bgOffset + FADE / 2)}
                  colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)", "rgba(0,0,0,0)"]}
                />
              </Rect>
              {/* Wrapped seam fade when near top/bottom edge */}
              <Rect x={0} y={bgOffset + h - FADE / 2} width={w} height={FADE}>
                <LinearGradient
                  start={vec(0, bgOffset + h - FADE / 2)}
                  end={vec(0, bgOffset + h + FADE / 2)}
                  colors={["rgba(0,0,0,0)", "rgba(0,0,0,1)", "rgba(0,0,0,0)"]}
                />
              </Rect>
            </>
          )}
          {STARS.slice(0, 50).map((st, i) => {
            const t1 = Math.sin(ts * st.speed + st.phase);
            const t2 = Math.sin(ts * st.speed2 + st.phase2);
            const twinkle = (t1 * 0.6 + t2 * 0.4) * 0.5 + 0.5;
            const opacity = st.o * (0.1 + twinkle * 0.9);
            const r = st.r * (0.9 + twinkle * 0.2);
            const cx = (st.x / GW) * w;
            const starY = ((st.y / GH) * h + bgOffset * (0.5 + st.o)) % h;
            return <Circle key={i} cx={cx} cy={starY} r={r} color={st.c} opacity={opacity} />;
          })}
        </Canvas>
      )}
    </View>
  );
}

type Section = 'trader' | 'upgrades';
type Screen = 'home' | 'trader' | 'upgrades';

export default function UpgradeOverlay({
  upgrades, score, level, shipColor, laserColor, unlockedSkins, unlockedPlasma, satelliteCount, onBuyTech, onSellTech, onUpgrade, onSell, onBuySkin, onSetShipColor, onSetLaserColor, onBuyPlasma, onBuySatellite, onSellSatellite, onLevels, onClose,
}: UpgradeOverlayProps) {
  const [screen, setScreen] = useState<Screen>('home');
  const [activeTab, setActiveTab] = useState(0);
  const [shipName, setShipName] = useState('Starship Alpha');
  const [editingName, setEditingName] = useState(false);
  const tileAnim = useRef(new Animated.Value(0)).current;
  const tileTarget = useRef<Screen | null>(null);
  const [activeTile, setActiveTile] = useState<Screen | null>(null);
  const screenFade = useRef(new Animated.Value(1)).current;
  const shipOrbit = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const orbitLoop = Animated.loop(
      Animated.timing(shipOrbit, { toValue: 1, duration: 4000, useNativeDriver: false, easing: Easing.linear }),
    );
    orbitLoop.start();
    return () => { orbitLoop.stop(); };
  }, []);

  const navigateTo = useCallback((target: Screen, tab?: number) => {
    Animated.timing(screenFade, { toValue: 0, duration: 250, useNativeDriver: false }).start(() => {
      setScreen(target);
      setActiveTab(tab ?? 0);
      Animated.timing(screenFade, { toValue: 1, duration: 250, useNativeDriver: false }).start();
    });
  }, []);

  const handleTilePress = useCallback((id: Screen) => {
    tileTarget.current = id;
    setActiveTile(id);
    tileAnim.setValue(0);
    Animated.sequence([
      // Fade in image
      Animated.timing(tileAnim, { toValue: 1, duration: 500, useNativeDriver: false }),
      // Pulse border: bright → dim → bright → dim
      Animated.timing(tileAnim, { toValue: 0.3, duration: 400, useNativeDriver: false }),
      Animated.timing(tileAnim, { toValue: 1, duration: 400, useNativeDriver: false }),
      Animated.timing(tileAnim, { toValue: 0.3, duration: 400, useNativeDriver: false }),
      Animated.timing(tileAnim, { toValue: 1, duration: 300, useNativeDriver: false }),
    ]).start(() => {
      const target = tileTarget.current;
      setActiveTile(null);
      tileAnim.setValue(0);
      if (target) {
        navigateTo(target);
        tileTarget.current = null;
      }
    });
  }, []);

  const section: Section = screen === 'trader' ? 'trader' : 'upgrades';

  const visibleTabs = section === 'trader'
    ? TABS.filter(tab => {
        if (tab.kind === 'skins') return SKINS.some(s => !unlockedSkins.has(s.id));
        if (tab.kind === 'plasma') return PLASMA_CORE_COLORS.some(c => !unlockedPlasma.has(c));
        if (tab.kind === 'satellite') return true;
        if (tab.items.length === 0) return true;
        return tab.items.some(item => item.buyCost !== undefined);
      })
    : TABS.filter(tab => {
        if (tab.kind === 'skins') return true;
        if (tab.kind === 'plasma') return true;
        if (tab.kind === 'satellite') return satelliteCount > 0;
        if (tab.items.length === 0) return true;
        return tab.items.some(item => upgrades[item.key] >= 1);
      });
  const currentTab = visibleTabs[activeTab] ?? visibleTabs[0];
  const plasmaHex = PLASMA_COLORS[laserColor]?.hex ?? '#7c4dff';

  const INSET = 12;

  return (
    <View
      style={{
        position: "absolute",
        top: OY + INSET, left: OX + INSET,
        width: GW - INSET * 2, height: GH - INSET * 2,
        backgroundColor: "rgba(0,0,0,0.88)",
        borderRadius: 16,
        borderWidth: 1.5,
        borderColor: `${plasmaHex}60`,
        overflow: "hidden",
        zIndex: 50,
      }}
    >
      <Animated.View style={{ flex: 1, opacity: screenFade }}>
      {screen === 'home' ? (
        /* ════════ HOME SCREEN ════════ */
        <View style={{ flex: 1 }}>
          <Image
            source={require('../../../assets/images/Menus/CheckpointMenupng.png')}
            style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.15 }}
            resizeMode="cover"
          />
          <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 20 }}>

          {/* Level */}
          <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 28, fontWeight: "900", letterSpacing: 4, textAlign: "center", marginBottom: 4 }}>
            LEVEL {level}
          </Text>

          {/* Score cards */}
          <View style={{ alignItems: "center", marginBottom: 8 }}>
            <View style={{ flexDirection: "row", alignItems: "center" }}>
              {String(score).split("").map((ch, i) => (
                <View key={i} style={{
                  width: 18, height: 26, marginHorizontal: 1,
                  backgroundColor: "#1a1a2e",
                  borderRadius: 3,
                  justifyContent: "center", alignItems: "center",
                }}>
                  <Text style={{
                    color: "#e0e0e0",
                    fontSize: 16, fontWeight: "bold",
                    fontVariant: ["tabular-nums"],
                  }}>
                    {ch}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          {/* Trader & Terminal tiles */}
          <View style={{ flexDirection: "row", gap: 12 }}>
            {([
              { id: 'trader' as Screen, label: 'Interstellar\nTrader', desc: 'Buy & sell tech', img: require('../../../assets/images/Menus/TraderMenu.png') },
              { id: 'upgrades' as Screen, label: 'Upgrade\nTerminal', desc: 'Level up gear', img: require('../../../assets/images/Menus/UpgradeMenu.png') },
            ]).map(s => {
              const isActive = activeTile === s.id;
              const imgOpacity = isActive
                ? tileAnim.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.9] })
                : 0.35;
              const borderOpacity = isActive
                ? tileAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0.19, 0.4, 0.56] })
                : 0.19;
              const glowOpacity = isActive
                ? tileAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 0.4, 0.9] })
                : 0;
              const glowRadius = isActive
                ? tileAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [0, 8, 20] })
                : 0;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => handleTilePress(s.id)}
                  style={{ flex: 1, aspectRatio: 0.85 }}
                >
                  <Animated.View style={{
                    flex: 1,
                    borderRadius: 16,
                    borderWidth: 1.5,
                    borderColor: isActive
                      ? tileAnim.interpolate({ inputRange: [0, 0.4, 1], outputRange: [`${plasmaHex}30`, `${plasmaHex}60`, `${plasmaHex}cc`] })
                      : `${plasmaHex}30`,
                    overflow: "hidden",
                    shadowColor: plasmaHex,
                    shadowOffset: { width: 0, height: 0 },
                    shadowOpacity: glowOpacity as any,
                    shadowRadius: glowRadius as any,
                  }}>
                    <Animated.Image source={s.img} style={{ position: "absolute", width: "100%", height: "100%", opacity: imgOpacity }} resizeMode="cover" />
                    <View style={{ flex: 1, justifyContent: "flex-end", alignItems: "center", paddingBottom: 14, paddingHorizontal: 8 }}>
                      <Text style={{
                        color: plasmaHex,
                        fontSize: 13,
                        fontWeight: "800",
                        letterSpacing: 0.8,
                        textAlign: "center",
                        lineHeight: 17,
                      }}>
                        {s.label}
                      </Text>
                      <Text style={{
                        color: `${plasmaHex}60`,
                        fontSize: 9,
                        fontWeight: "600",
                        letterSpacing: 0.5,
                        marginTop: 4,
                      }}>
                        {s.desc}
                      </Text>
                    </View>
                  </Animated.View>
                </Pressable>
              );
            })}
          </View>

          <View style={{ height: 16 }} />

          {/* Continue */}
          <TouchableOpacity
            onPress={onClose}
            activeOpacity={0.7}
            style={{
              paddingVertical: 16,
              borderRadius: 14,
              backgroundColor: `${plasmaHex}18`,
              borderWidth: 2,
              borderColor: `${plasmaHex}80`,
              alignItems: "center",
              shadowColor: plasmaHex,
              shadowOffset: { width: 0, height: 0 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
            }}
          >
            <Text style={{ color: plasmaHex, fontSize: 18, fontWeight: "900", letterSpacing: 3 }}>
              ▶  CONTINUE
            </Text>
          </TouchableOpacity>

          {/* Levels */}
          <TouchableOpacity
            onPress={onLevels}
            activeOpacity={0.7}
            style={{
              paddingVertical: 12,
              borderRadius: 12,
              backgroundColor: `${plasmaHex}10`,
              borderWidth: 1.5,
              borderColor: `${plasmaHex}50`,
              alignItems: "center",
              marginTop: 8,
            }}
          >
            <Text style={{ color: plasmaHex, fontSize: 14, fontWeight: "700", letterSpacing: 2 }}>
              LEVELS
            </Text>
          </TouchableOpacity>

          <View style={{ flex: 1 }} />
        </View>
        </View>
      ) : (
        /* ════════ TRADER / TERMINAL SUB-SCREEN ════════ */
        <>
          {/* Background image */}
          <Image
            source={screen === 'trader'
              ? require('../../../assets/images/Menus/TraderMenu.png')
              : require('../../../assets/images/Menus/UpgradeMenu.png')}
            style={{ position: "absolute", width: "100%", height: "100%", opacity: 0.12 }}
            resizeMode="cover"
          />
          {/* Header */}
          <View style={{
            alignItems: "center",
            paddingHorizontal: 14,
            paddingTop: 12,
            paddingBottom: 4,
          }}>
            <Text style={{ color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 1.5 }}>
              {screen === 'trader' ? 'INTERSTELLAR TRADER' : 'UPGRADE TERMINAL'}
            </Text>
            <View style={{ flexDirection: "row", alignItems: "center", marginTop: 6 }}>
              {String(score).split("").map((ch, i) => (
                <View key={i} style={{
                  width: 18, height: 26, marginHorizontal: 1,
                  backgroundColor: "#1a1a2e",
                  borderRadius: 3,
                  justifyContent: "center", alignItems: "center",
                }}>
                  <Text style={{
                    color: "#e0e0e0",
                    fontSize: 16, fontWeight: "bold",
                    fontVariant: ["tabular-nums"],
                  }}>
                    {ch}
                  </Text>
                </View>
              ))}
            </View>
          </View>

          <View style={{ height: 1, backgroundColor: `${plasmaHex}35`, marginHorizontal: 10 }} />

      {/* ── Tab Bar ── */}
      {visibleTabs.length > 0 && (
        section === 'trader' ? (
          /* ── Trader: 2×2 Rectangle Cards ── */
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, justifyContent: "center" }}>
            {(['starship', 'weapons', 'tech', 'support'] as const).map(group => {
              const groupTabs = visibleTabs.filter(t => t.group === group);
              if (groupTabs.length === 0) return null;
              const labels = { starship: 'STARSHIP', weapons: 'WEAPONS', tech: 'TECH', support: 'SUPPORT' } as const;
              const isActive = currentTab && currentTab.group === group;
              const itemCount = groupTabs.reduce((sum, t) => {
                if (t.kind === 'skins') return sum + SKINS.filter(s => !unlockedSkins.has(s.id)).length;
                if (t.kind === 'plasma') return sum + PLASMA_CORE_COLORS.filter(c => !unlockedPlasma.has(c)).length;
                if (t.kind === 'satellite') return sum + 1;
                return sum + t.items.filter(i => i.buyCost !== undefined).length;
              }, 0);
              return (
                <View key={group} style={{ width: '47%' }}>
                  <TouchableOpacity
                    onPress={() => setActiveTab(visibleTabs.indexOf(groupTabs[0]))}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isActive ? `${plasmaHex}22` : `${plasmaHex}08`,
                      borderWidth: 1.5,
                      borderColor: isActive ? `${plasmaHex}50` : `${plasmaHex}15`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{
                      color: isActive ? plasmaHex : "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 1,
                    }}>
                      {labels[group]}
                    </Text>
                    <Text style={{
                      color: "rgba(255,255,255,0.25)",
                      fontSize: 8,
                      marginTop: 2,
                    }}>
                      {itemCount} {itemCount === 1 ? 'item' : 'items'}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        ) : (
          /* ── Upgrade Terminal: Rectangle Cards ── */
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingHorizontal: 10, paddingTop: 8, paddingBottom: 4, justifyContent: "center" }}>
            {(['starship', 'weapons', 'tech', 'support'] as const).map(group => {
              const groupTabs = visibleTabs.filter(t => t.group === group);
              if (groupTabs.length === 0) return null;
              const labels = { starship: 'STARSHIP', weapons: 'WEAPONS', tech: 'TECH', support: 'SUPPORT' } as const;
              const isActive = currentTab && currentTab.group === group;
              return (
                <View key={group} style={{ width: '47%' }}>
                  <TouchableOpacity
                    onPress={() => setActiveTab(visibleTabs.indexOf(groupTabs[0]))}
                    activeOpacity={0.7}
                    style={{
                      paddingVertical: 10,
                      borderRadius: 10,
                      backgroundColor: isActive ? `${plasmaHex}22` : `${plasmaHex}08`,
                      borderWidth: 1.5,
                      borderColor: isActive ? `${plasmaHex}50` : `${plasmaHex}15`,
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Text style={{
                      color: isActive ? plasmaHex : "rgba(255,255,255,0.5)",
                      fontSize: 11,
                      fontWeight: "700",
                      letterSpacing: 1,
                    }}>
                      {labels[group]}
                    </Text>
                  </TouchableOpacity>
                </View>
              );
            })}
          </View>
        )
      )}

      {/* ── Content Area ── */}
      <ScrollView
        style={{ flex: 1 }}
        showsVerticalScrollIndicator={true}
        contentContainerStyle={{ padding: 10, paddingBottom: 12 }}
      >
        {visibleTabs.length === 0 ? (
          <View style={{ alignItems: "center", paddingTop: 40 }}>
            <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, textAlign: "center" }}>
              {section === 'trader'
                ? 'All tech purchased!'
                : 'No upgradeable tech installed.\nVisit the Interstellar Trader first!'}
            </Text>
          </View>
        ) : !currentTab ? null
        : (
          <>
            {/* Sub-tabs for active group */}
            {(() => {
              const groupTabs = visibleTabs.filter(t => t.group === currentTab.group);
              if (groupTabs.length <= 1) return null;
              return (
                <View style={{ flexDirection: "row", gap: 6, marginBottom: 8 }}>
                  {groupTabs.map(t => {
                    const i = visibleTabs.indexOf(t);
                    const subActive = i === activeTab;
                    return (
                      <TouchableOpacity
                        key={t.id}
                        onPress={() => setActiveTab(i)}
                        activeOpacity={0.7}
                        style={{
                          flex: 1,
                          paddingVertical: 6,
                          borderRadius: 6,
                          backgroundColor: subActive ? `${plasmaHex}25` : `${plasmaHex}08`,
                          borderWidth: 1,
                          borderColor: subActive ? `${plasmaHex}50` : `${plasmaHex}12`,
                          alignItems: "center",
                        }}
                      >
                        <Text style={{
                          color: subActive ? plasmaHex : "rgba(255,255,255,0.4)",
                          fontSize: 9,
                          fontWeight: "700",
                          letterSpacing: 0.3,
                        }}
                        numberOfLines={1}
                        >
                          {t.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}
            {currentTab.kind === 'skins' ? (
          <SkinSelector
            mode={section === 'trader' ? 'trader' : 'terminal'}
            shipColor={shipColor}
            unlockedSkins={unlockedSkins}
            score={score}
            onSetShipColor={onSetShipColor}
            onBuySkin={onBuySkin}
            plasmaHex={plasmaHex}
          />
        ) : currentTab.kind === 'plasma' ? (
          <PlasmaSelector
            mode={section === 'trader' ? 'trader' : 'terminal'}
            laserColor={laserColor}
            unlockedPlasma={unlockedPlasma}
            score={score}
            onSetLaserColor={onSetLaserColor}
            onBuyPlasma={onBuyPlasma}
            plasmaHex={plasmaHex}
          />
        ) : currentTab.kind === 'satellite' ? (
          section === 'trader' ? (
            <View>
              {(() => {
                const canBuy = satelliteCount < gameConfig.maxSatellites && score >= SAT_COST;
                const canSell = satelliteCount > 0;
                const sellVal = Math.floor(SAT_COST / 2);
                return (
                  <View style={{
                    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                    paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4, borderRadius: 10,
                    backgroundColor: `${plasmaHex}30`, borderWidth: 1, borderColor: `${plasmaHex}60`,
                  }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: plasmaHex, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 }}>
                        Satellite
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, marginTop: 1 }}>
                        Orbiting defense drone
                      </Text>
                      <View style={{ flexDirection: "row", gap: 2, marginTop: 4 }}>
                        {Array.from({ length: gameConfig.maxSatellites }, (_, i) => (
                          <View
                            key={i}
                            style={{
                              width: 8, height: 8, borderRadius: 2,
                              backgroundColor: i < satelliteCount ? plasmaHex : "rgba(255,255,255,0.08)",
                              ...(i < satelliteCount ? { shadowColor: plasmaHex, shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.6, shadowRadius: 3 } : {}),
                            }}
                          />
                        ))}
                      </View>
                    </View>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      {satelliteCount >= gameConfig.maxSatellites ? (
                        <View style={{
                          minWidth: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                          borderWidth: 1, borderColor: `${plasmaHex}66`, backgroundColor: `${plasmaHex}18`, alignItems: "center",
                        }}>
                          <Text style={{ color: plasmaHex, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>MAX</Text>
                        </View>
                      ) : (
                        <TouchableOpacity
                          onPress={() => canBuy && onBuySatellite()}
                          disabled={!canBuy}
                          activeOpacity={0.7}
                          style={{
                            minWidth: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                            borderWidth: 1, borderColor: canBuy ? `${plasmaHex}80` : "rgba(255,255,255,0.1)",
                            backgroundColor: canBuy ? `${plasmaHex}20` : "rgba(255,255,255,0.03)", alignItems: "center",
                          }}
                        >
                          <Text style={{ color: canBuy ? plasmaHex : "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "700" }}>
                            {formatCost(SAT_COST)}
                          </Text>
                        </TouchableOpacity>
                      )}
                      {canSell && (
                        <TouchableOpacity
                          onPress={onSellSatellite}
                          activeOpacity={0.7}
                          style={{
                            minWidth: 72, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                            borderWidth: 1, borderColor: `${plasmaHex}80`, backgroundColor: `${plasmaHex}18`, alignItems: "center",
                          }}
                        >
                          <Text style={{ color: plasmaHex, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>
                            SELL {formatCost(sellVal)}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })()}
            </View>
          ) : (
            <View style={{ gap: 4 }}>
              {currentTab.items.map((item) => {
                const level = upgrades[item.key];
                const cost = getUpgradeCost(level);
                const canAfford = score >= cost && level < MAX_LEVEL;
                const isMaxed = level >= MAX_LEVEL;
                const sellVal = getSellValue(level);
                return (
                  <View
                    key={item.key}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4, borderRadius: 10,
                      backgroundColor: `${plasmaHex}30`, borderWidth: 1, borderColor: `${plasmaHex}60`,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: plasmaHex, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 }}>
                        {item.label}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 }}>
                        {item.desc}{item.key === "thrusterLevel" ? ` (+${level * 100}% speed)` : ""}
                      </Text>
                      <LevelPips level={level} color={plasmaHex} />
                    </View>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => canAfford && onUpgrade(item.key)}
                        disabled={!canAfford}
                        activeOpacity={0.7}
                        style={{
                          minWidth: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isMaxed ? `${plasmaHex}66` : canAfford ? `${plasmaHex}80` : "rgba(255,255,255,0.1)",
                          backgroundColor: isMaxed ? `${plasmaHex}18` : canAfford ? `${plasmaHex}20` : "rgba(255,255,255,0.03)",
                          alignItems: "center",
                        }}
                      >
                        {isMaxed ? (
                          <Text style={{ color: plasmaHex, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>MAX</Text>
                        ) : (
                          <Text style={{ color: canAfford ? plasmaHex : "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "700" }}>
                            {formatCost(cost)}
                          </Text>
                        )}
                      </TouchableOpacity>
                      {level > 1 && sellVal > 0 && (
                        <TouchableOpacity
                          onPress={() => onSell(item.key)}
                          activeOpacity={0.7}
                          style={{
                            minWidth: 72, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                            borderWidth: 1, borderColor: `${plasmaHex}80`, backgroundColor: `${plasmaHex}18`, alignItems: "center",
                          }}
                        >
                          <Text style={{ color: plasmaHex, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>
                            SELL {formatCost(sellVal)}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : section === 'trader' ? (
          <View style={{ gap: 4 }}>
            {(() => {
              const buyable = currentTab.items.filter(i => i.buyCost !== undefined);
              const allOwned = buyable.every(i => upgrades[i.key] >= 1);
              if (buyable.length === 0) return null;
              return (
                <>
                  {allOwned && (
                    <View style={{ alignItems: "center", paddingVertical: 12 }}>
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>All purchased!</Text>
                    </View>
                  )}
                  {buyable.map((item) => {
                    const owned = upgrades[item.key] >= 1;
                    const level = upgrades[item.key];
                    const canBuy = !owned && score >= item.buyCost!;
                    const sellVal = Math.floor(item.buyCost! / 2);
                    return (
                      <View
                        key={item.key}
                        style={{
                          flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                          paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4, borderRadius: 10,
                          backgroundColor: `${plasmaHex}30`, borderWidth: 1, borderColor: `${plasmaHex}60`,
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={{ color: plasmaHex, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 }}>
                            {item.label}
                          </Text>
                          <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 }}>
                            {item.desc}{item.key === "thrusterLevel" && owned ? ` (+${1 * 100}% speed)` : ""}
                          </Text>
                          <LevelPips level={level} color={plasmaHex} />
                        </View>
                        <View style={{ alignItems: "center", gap: 4 }}>
                          {owned ? (
                            <View style={{
                              minWidth: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                              borderWidth: 1, borderColor: `${plasmaHex}66`, backgroundColor: `${plasmaHex}18`, alignItems: "center",
                            }}>
                              <Text style={{ color: plasmaHex, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>OWNED</Text>
                            </View>
                          ) : (
                            <TouchableOpacity
                              onPress={() => canBuy && onBuyTech(item.key)}
                              disabled={!canBuy}
                              activeOpacity={0.7}
                              style={{
                                minWidth: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                                borderWidth: 1,
                                borderColor: canBuy ? `${plasmaHex}80` : "rgba(255,255,255,0.1)",
                                backgroundColor: canBuy ? `${plasmaHex}20` : "rgba(255,255,255,0.03)",
                                alignItems: "center",
                              }}
                            >
                              <Text style={{
                                color: canBuy ? plasmaHex : "rgba(255,255,255,0.25)",
                                fontSize: 11, fontWeight: "700",
                              }}>
                                {formatCost(item.buyCost!)}
                              </Text>
                            </TouchableOpacity>
                          )}
                          {owned && (
                            <TouchableOpacity
                              onPress={() => onSellTech(item.key)}
                              activeOpacity={0.7}
                              style={{
                                minWidth: 72, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                                borderWidth: 1, borderColor: `${plasmaHex}80`, backgroundColor: `${plasmaHex}18`, alignItems: "center",
                              }}
                            >
                              <Text style={{ color: plasmaHex, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>
                                SELL {formatCost(sellVal)}
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    );
                  })}
                </>
              );
            })()}
          </View>
        ) : (
          <View style={{ gap: 4 }}>
            {currentTab.items
              .filter(item => upgrades[item.key] >= 1)
              .map((item) => {
                const level = upgrades[item.key];
                const cost = getUpgradeCost(level);
                const canAfford = score >= cost && level < MAX_LEVEL;
                const isMaxed = level >= MAX_LEVEL;
                const sellVal = getSellValue(level);
                return (
                  <View
                    key={item.key}
                    style={{
                      flexDirection: "row", alignItems: "center", justifyContent: "space-between",
                      paddingVertical: 10, paddingHorizontal: 12, marginBottom: 4, borderRadius: 10,
                      backgroundColor: `${plasmaHex}30`, borderWidth: 1, borderColor: `${plasmaHex}60`,
                    }}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={{ color: plasmaHex, fontSize: 14, fontWeight: "600", letterSpacing: 0.3 }}>
                        {item.label}
                      </Text>
                      <Text style={{ color: "rgba(255,255,255,0.55)", fontSize: 10, marginTop: 1 }}>
                        {item.desc}{item.key === "shieldLevel" ? ` (${level * 25} FP)` : ""}{item.key === "thrusterLevel" ? ` (+${level * 100}% speed)` : ""}
                      </Text>
                      <LevelPips level={level} color={plasmaHex} />
                    </View>
                    <View style={{ alignItems: "center", gap: 4 }}>
                      <TouchableOpacity
                        onPress={() => canAfford && onUpgrade(item.key)}
                        disabled={!canAfford}
                        activeOpacity={0.7}
                        style={{
                          minWidth: 72, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 8,
                          borderWidth: 1,
                          borderColor: isMaxed ? `${plasmaHex}66` : canAfford ? `${plasmaHex}80` : "rgba(255,255,255,0.1)",
                          backgroundColor: isMaxed ? `${plasmaHex}18` : canAfford ? `${plasmaHex}20` : "rgba(255,255,255,0.03)",
                          alignItems: "center",
                        }}
                      >
                        {isMaxed ? (
                          <Text style={{ color: plasmaHex, fontSize: 11, fontWeight: "700", letterSpacing: 1 }}>MAX</Text>
                        ) : (
                          <Text style={{ color: canAfford ? plasmaHex : "rgba(255,255,255,0.25)", fontSize: 11, fontWeight: "700" }}>
                            {formatCost(cost)}
                          </Text>
                        )}
                      </TouchableOpacity>
                      {level > 1 && sellVal > 0 && (
                        <TouchableOpacity
                          onPress={() => onSell(item.key)}
                          activeOpacity={0.7}
                          style={{
                            minWidth: 72, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8,
                            borderWidth: 1, borderColor: `${plasmaHex}80`, backgroundColor: `${plasmaHex}18`, alignItems: "center",
                          }}
                        >
                          <Text style={{ color: plasmaHex, fontSize: 9, fontWeight: "700", letterSpacing: 0.5 }}>
                            SELL {formatCost(sellVal)}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                  </View>
                );
            })}
          </View>
        )}
          </>
        )}
      </ScrollView>

        {/* ── Ship Info Panel (Upgrade Terminal only) ── */}
        {section === 'upgrades' && (
          <View style={{ height: '35%', borderTopWidth: 1, borderTopColor: `${plasmaHex}40`, padding: 14 }}>
          <View style={{
            flex: 1,
            borderRadius: 12,
            backgroundColor: "#050510",
            borderWidth: 1,
            borderColor: `${plasmaHex}50`,
            overflow: "hidden",
          }}>
            {/* Skia space background with tiled scrolling + twinkling stars */}
            <SpaceBgCanvas />
            <View style={{ flexDirection: "row", flex: 1 }}>
              {/* Info div - 1/3 width */}
              <View style={{ flex: 1, padding: 14 }}>
                {/* Name with rename */}
                <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 6 }}>
                  {editingName ? (
                    <TextInput
                      value={shipName}
                      onChangeText={setShipName}
                      onBlur={() => setEditingName(false)}
                      onSubmitEditing={() => setEditingName(false)}
                      autoFocus
                      maxLength={20}
                      style={{
                        color: "#fff",
                        fontSize: 15,
                        fontWeight: "700",
                        borderBottomWidth: 1,
                        borderBottomColor: `${plasmaHex}80`,
                        paddingVertical: 2,
                        paddingHorizontal: 0,
                        minWidth: 100,
                      }}
                    />
                  ) : (
                    <TouchableOpacity onPress={() => setEditingName(true)} activeOpacity={0.7} style={{ flexDirection: "row", alignItems: "center", gap: 4 }}>
                      <Text style={{ color: "#fff", fontSize: 15, fontWeight: "700" }}>{shipName}</Text>
                      <Text style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>✎</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 2 }}>
                  Type: <Text style={{ color: "rgba(255,255,255,0.6)" }}>Fighter</Text>
                </Text>
                <Text style={{ color: "rgba(255,255,255,0.4)", fontSize: 10, marginBottom: 6 }}>
                  Plasma Core: <Text style={{ color: plasmaHex }}>{laserColor}</Text>
                </Text>

                {/* Blasters */}
                {(() => {
                  const blasters: string[] = [];
                  if (upgrades.blasterLevel >= 1) blasters.push("Photon Blasters");
                  if (upgrades.fireRateLevel >= 1) blasters.push("Rapid Fire");
                  if (upgrades.homingLevel >= 1) blasters.push("Homing");
                  return blasters.length > 0 ? (
                    <View style={{ marginBottom: 4 }}>
                      <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700" }}>Blasters</Text>
                      {blasters.map(b => (
                        <Text key={b} style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, marginLeft: 8 }}>- {b}</Text>
                      ))}
                    </View>
                  ) : null;
                })()}

                {/* Arch Weapons */}
                {(() => {
                  const weapons: string[] = [];
                  if (upgrades.waveLevel >= 1) weapons.push("Arc Wave");
                  if (upgrades.nukeLevel >= 1) weapons.push("Plasma Nuke");
                  if (upgrades.plasmaLevel >= 1) weapons.push("Plasma Beam");
                  if (upgrades.crossLevel >= 1) weapons.push("Cross Laser");
                  if (upgrades.chainLevel >= 1) weapons.push("Chain Lightning");
                  if (upgrades.discLevel >= 1) weapons.push("Disc Launcher");
                  if (upgrades.magnetLevel >= 1) weapons.push("Tractor Beam");
                  return weapons.length > 0 ? (
                    <View style={{ marginBottom: 4 }}>
                      <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700" }}>Arch Weapons</Text>
                      {weapons.map(w => (
                        <Text key={w} style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, marginLeft: 8 }}>- {w}</Text>
                      ))}
                    </View>
                  ) : null;
                })()}

                {/* Thrusters */}
                {upgrades.thrusterLevel >= 1 && (
                  <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700", marginBottom: 4 }}>
                    Thrusters: <Text style={{ color: "rgba(255,255,255,0.5)", fontWeight: "400" }}>Lv.{upgrades.thrusterLevel}</Text>
                  </Text>
                )}

                {/* Forcefield */}
                {upgrades.shieldLevel >= 1 && (
                  <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700", marginBottom: 4 }}>
                    Forcefield: <Text style={{ color: "rgba(255,255,255,0.5)", fontWeight: "400" }}>Lv.{upgrades.shieldLevel} ({upgrades.shieldLevel * 25} FP)</Text>
                  </Text>
                )}

                {/* Support Defence Systems */}
                {satelliteCount > 0 && (
                  <View style={{ marginTop: 2 }}>
                    <Text style={{ color: plasmaHex, fontSize: 10, fontWeight: "700" }}>Support Defence Systems</Text>
                    <Text style={{ color: "rgba(255,255,255,0.5)", fontSize: 9, marginLeft: 8 }}>- Satellite Drone x{satelliteCount}</Text>
                  </View>
                )}
              </View>
              {/* Ship div - 2/3 width */}
              <View style={{ flex: 2, justifyContent: "center", alignItems: "center" }}>
                <Animated.Image
                  source={SHIP_IMAGES[shipColor]}
                  style={{
                    width: "80%",
                    height: "100%",
                    transform: [
                      { perspective: 600 },
                      {
                        rotateX: shipOrbit.interpolate({
                          inputRange:  [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
                          outputRange: ["0deg", "-5.7deg", "-8deg", "-5.7deg", "0deg", "5.7deg", "8deg", "5.7deg", "0deg"],
                        }) as unknown as string,
                      },
                      {
                        rotateY: shipOrbit.interpolate({
                          inputRange:  [0, 0.125, 0.25, 0.375, 0.5, 0.625, 0.75, 0.875, 1],
                          outputRange: ["8deg", "5.7deg", "0deg", "-5.7deg", "-8deg", "-5.7deg", "0deg", "5.7deg", "8deg"],
                        }) as unknown as string,
                      },
                    ],
                  }}
                  resizeMode="contain"
                />
              </View>
            </View>
          </View>
          </View>
        )}

        {/* ── Bottom Bar ── */}
        <View style={{
          paddingHorizontal: 14,
          paddingVertical: 10,
          borderTopWidth: 1,
          borderTopColor: `${plasmaHex}30`,
        }}>
          <View style={{ flexDirection: "row", gap: 10 }}>
            <TouchableOpacity
              onPress={() => navigateTo('home')}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: "rgba(255,255,255,0.06)",
                borderWidth: 1,
                borderColor: "rgba(255,255,255,0.15)",
                alignItems: "center",
              }}
            >
              <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
                ‹ BACK
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => navigateTo(section === 'trader' ? 'upgrades' : 'trader')}
              activeOpacity={0.7}
              style={{
                flex: 1,
                paddingVertical: 10,
                borderRadius: 8,
                backgroundColor: `${plasmaHex}20`,
                borderWidth: 1,
                borderColor: `${plasmaHex}50`,
                alignItems: "center",
              }}
            >
              <Text style={{ color: plasmaHex, fontSize: 12, fontWeight: "700", letterSpacing: 0.5 }}>
                {section === 'trader' ? '🔧 UPGRADES' : '🛒 TRADER'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
        </>
      )}
      </Animated.View>
    </View>
  );
}
