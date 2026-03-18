import React, { useRef, useEffect } from "react";
import { View, Text, TouchableOpacity, Animated } from "react-native";
import { Feather } from "@expo/vector-icons";

interface MenuItem {
  id: string;
  label: string;
  icon: keyof typeof Feather.glyphMap;
}

const BUTTON_STYLES: Record<string, { border: string; accent: string }> = {
  new_game: { border: "rgba(124,77,255,0.6)", accent: "rgba(124,77,255,0.12)" },
  options:  { border: "rgba(255,255,255,0.2)", accent: "rgba(255,255,255,0.06)" },
  quit_game:{ border: "rgba(255,71,87,0.5)", accent: "rgba(255,71,87,0.1)" },
};

export default function AnimatedMenuButton({
  item,
  index,
  onPress,
  customStyle,
  locked,
  lockLabel,
}: {
  item: MenuItem;
  index: number;
  onPress: (id: string) => void;
  customStyle?: { border: string; accent: string };
  locked?: boolean;
  lockLabel?: string;
}) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 600,
        delay: 400 + index * 180,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 600,
        delay: 400 + index * 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

  const handlePressIn = () => {
    if (locked) return;
    Animated.spring(scaleAnim, {
      toValue: 0.96,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    if (locked) return;
    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 3,
      useNativeDriver: true,
    }).start();
  };

  const style = customStyle ?? BUTTON_STYLES[item.id] ?? BUTTON_STYLES.options;

  return (
    <Animated.View
      className="w-full"
      style={{
        opacity: fadeAnim,
        transform: [{ translateY: slideAnim }, { scale: scaleAnim }],
      }}
    >
      <TouchableOpacity
        activeOpacity={locked ? 1 : 0.7}
        onPress={() => { if (!locked) onPress(item.id); }}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={{
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          paddingVertical: locked ? 10 : 16,
          paddingHorizontal: 24,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: locked ? "rgba(255,255,255,0.08)" : style.border,
          backgroundColor: locked ? "rgba(255,255,255,0.03)" : style.accent,
          opacity: locked ? 0.45 : 1,
        }}
      >
        <View style={{ marginRight: 10 }}>
          <Feather name={locked ? "lock" : item.icon} size={locked ? 16 : 20} color={locked ? "#666" : "#fff"} />
        </View>
        <View style={{ alignItems: locked ? "flex-start" : "center" }}>
          <Text style={{ fontSize: locked ? 14 : 17, fontWeight: "600", color: locked ? "#666" : "#fff", letterSpacing: 1.2 }}>
            {item.label}
          </Text>
          {locked && lockLabel && (
            <Text style={{ fontSize: 9, color: "#555", marginTop: 1 }}>{lockLabel}</Text>
          )}
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
}
