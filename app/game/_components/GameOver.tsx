import React, { useEffect, useRef } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { GW, GH, OX, OY, PLASMA_COLORS } from "../_shared/constants";

const INSET = 12;

interface GameOverProps {
  visible: boolean;
  score: number;
  level: number;
  isBonus: boolean;
  laserColor: string;
  permadeath?: boolean;
  onRestart: () => void;
  onMainMenu: () => void;
}

export default function GameOver({ visible, score, level, isBonus, laserColor, permadeath, onRestart, onMainMenu }: GameOverProps) {
  const plasmaHex = PLASMA_COLORS[laserColor as keyof typeof PLASMA_COLORS]?.hex ?? '#7c4dff';
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      fadeAnim.setValue(0);
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  if (!visible) return null;
  return (
    <Animated.View
      style={{
        position: "absolute",
        top: OY, left: OX,
        width: GW, height: GH,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.65)",
        zIndex: 50,
        opacity: fadeAnim,
      }}
    >
      {/* Score cards at top */}
      <View style={{ position: "absolute", top: 20, alignItems: "center" }}>
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
        <Text style={{ color: "rgba(255,255,255,0.7)", fontSize: 28, fontWeight: "900", letterSpacing: 4, marginTop: 6 }}>
          LEVEL {isBonus ? `${level} BONUS` : level}
        </Text>
      </View>

      {/* GAME / OVER stacked */}
      <View style={{ alignItems: "center", marginBottom: 60, marginTop: -80 }}>
        <Text style={{
          color: "#ff4444",
          fontSize: 52,
          fontWeight: "900",
          letterSpacing: 12,
        }}>
          GAME
        </Text>
        <Text style={{
          color: "#ff4444",
          fontSize: 52,
          fontWeight: "900",
          letterSpacing: 12,
          marginTop: -8,
        }}>
          OVER
        </Text>
      </View>

      {/* Buttons */}
      <View style={{ width: "70%", gap: 10 }}>
        {!permadeath && (
        <TouchableOpacity
          onPress={onRestart}
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
            TRY AGAIN
          </Text>
        </TouchableOpacity>
        )}

        <TouchableOpacity
          onPress={onMainMenu}
          activeOpacity={0.7}
          style={{
            paddingVertical: 12,
            borderRadius: 12,
            backgroundColor: `${plasmaHex}10`,
            borderWidth: 1.5,
            borderColor: `${plasmaHex}50`,
            alignItems: "center",
          }}
        >
          <Text style={{ color: plasmaHex, fontSize: 14, fontWeight: "700", letterSpacing: 2 }}>
            MAIN MENU
          </Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}
