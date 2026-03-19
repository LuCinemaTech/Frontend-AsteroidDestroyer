import React from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { SHIP_IMAGES, PLASMA_COLORS } from "../_shared/constants";

type PlasmaColor = 'Blue' | 'Yellow' | 'Orange' | 'Red' | 'Purple' | 'Silver' | 'Gold';

interface SelectionProps {
  visible: boolean;
  shipColor: string;
  laserColor: string;
  unlockedPlasma: Set<string>;
  onSetShipColor: (c: string) => void;
  onSetLaserColor: (c: PlasmaColor) => void;
  onContinue: () => void;
}

export default function SelectionOverlay({
  visible, shipColor, laserColor, unlockedPlasma,
  onSetShipColor, onSetLaserColor, onContinue,
}: SelectionProps) {
  if (!visible) return null;
  const plasmaHex = PLASMA_COLORS[laserColor as keyof typeof PLASMA_COLORS]?.hex ?? '#7c4dff';
  return (
    <View
      style={{
        position: "absolute", left: 0, right: 0, top: 0, bottom: 0,
        alignItems: "center", justifyContent: "center",
        backgroundColor: "rgba(0,0,0,0.85)",
      }}
    >
      <Text style={{ color: "#fff", fontSize: 24, fontWeight: "bold", marginBottom: 24 }}>
        Customize
      </Text>

      {/* Ship picker */}
      <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>Ship</Text>
      <View style={{ flexDirection: "row", gap: 16, marginBottom: 24 }}>
        {(["SilverBlue", "BlackRed"] as const).map((c) => (
          <TouchableOpacity
            key={c}
            onPress={() => onSetShipColor(c)}
            style={{
              borderWidth: shipColor === c ? 2 : 0,
              borderColor: plasmaHex,
              borderRadius: 8,
              padding: 4,
            }}
          >
            <Image
              source={SHIP_IMAGES[c]}
              style={{ width: 40, height: 60 }}
              resizeMode="contain"
            />
          </TouchableOpacity>
        ))}
      </View>

      {/* Laser picker */}
      <Text style={{ color: "#fff", fontSize: 16, marginBottom: 12 }}>Laser</Text>
      <View style={{ flexDirection: "row", gap: 12, marginBottom: 32, flexWrap: "wrap", justifyContent: "center" }}>
        {(['Blue', 'Yellow', 'Orange', 'Red', 'Purple', 'Silver', 'Gold'] as PlasmaColor[]).filter(c => unlockedPlasma.has(c)).map((c) => {
          const pc = PLASMA_COLORS[c];
          return (
            <TouchableOpacity
              key={c}
              onPress={() => onSetLaserColor(c)}
              style={{
                borderWidth: laserColor === c ? 2 : 0,
                borderColor: plasmaHex,
                borderRadius: 8,
                padding: 4,
                alignItems: "center",
              }}
            >
              <View style={{
                width: 28, height: 28,
                borderRadius: 6,
                backgroundColor: pc.hex,
              }} />
              <Text style={{ color: pc.hex, fontSize: 9, marginTop: 2, fontWeight: "600" }}>
                {pc.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <TouchableOpacity
        onPress={onContinue}
        style={{
          backgroundColor: `${plasmaHex}30`, paddingHorizontal: 32, paddingVertical: 12,
          borderRadius: 8, borderWidth: 1.5, borderColor: `${plasmaHex}60`,
        }}
      >
        <Text style={{ color: plasmaHex, fontSize: 18, fontWeight: "bold" }}>Continue</Text>
      </TouchableOpacity>
    </View>
  );
}
