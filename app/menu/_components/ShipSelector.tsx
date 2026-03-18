import React, { useRef, useState, useCallback, useEffect } from "react";
import {
  View,
  Text,
  Image,
  Animated,
  PanResponder,
  Platform,
} from "react-native";
import { Feather } from "@expo/vector-icons";

const SHIPS = [
  { id: "SilverBlue", name: "Silver Blue", image: require("../../../assets/images/Starships/Ship-SilverBlue.png"), unlocked: true },
  { id: "BlackRed", name: "Black Red", image: require("../../../assets/images/Starships/Ship-BlackRed.png"), unlocked: false },
  { id: "Gold", name: "Gold", image: require("../../../assets/images/Starships/Ship-Gold.png"), unlocked: false },
];

const SHIP_SIZE = 180;
const SWIPE_THRESHOLD = 40;

export default function ShipSelector({ width }: { width: number }) {
  const [index, setIndex] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const tiltX = useRef(new Animated.Value(0)).current;
  const tiltY = useRef(new Animated.Value(0)).current;
  const shipRef = useRef<View>(null);

  useEffect(() => {
    if (Platform.OS !== "web" || !shipRef.current) return;
    const node = shipRef.current as unknown as HTMLElement;
    const handleMove = (e: MouseEvent) => {
      const rect = node.getBoundingClientRect();
      const cx = (e.clientX - rect.left) / rect.width - 0.5;
      const cy = (e.clientY - rect.top) / rect.height - 0.5;
      Animated.spring(tiltY, { toValue: cx * 12, useNativeDriver: true, friction: 12 }).start();
      Animated.spring(tiltX, { toValue: -cy * 12, useNativeDriver: true, friction: 12 }).start();
    };
    const handleLeave = () => {
      Animated.spring(tiltX, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
      Animated.spring(tiltY, { toValue: 0, useNativeDriver: true, friction: 8 }).start();
    };
    node.addEventListener("mousemove", handleMove);
    node.addEventListener("mouseleave", handleLeave);
    return () => {
      node.removeEventListener("mousemove", handleMove);
      node.removeEventListener("mouseleave", handleLeave);
    };
  }, [index]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 10,
      onPanResponderMove: (_, g) => {
        translateX.setValue(g.dx);
      },
      onPanResponderRelease: (_, g) => {
        if (g.dx < -SWIPE_THRESHOLD) {
          setIndex((i) => Math.min(i + 1, SHIPS.length - 1));
        } else if (g.dx > SWIPE_THRESHOLD) {
          setIndex((i) => Math.max(i - 1, 0));
        }
        Animated.spring(translateX, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
      },
    })
  ).current;

  const ship = SHIPS[index];

  return (
    <View style={{ alignItems: "center", width }} {...panResponder.panHandlers}>
      <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 20 }}>
        {/* Left arrow */}
        <Feather
          name="chevron-left"
          size={28}
          color={index > 0 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
        />

        {/* Ship image */}
        <Animated.View
          ref={shipRef}
          style={{
            transform: [{ translateX }, { perspective: 600 }, { rotateX: tiltX.interpolate({ inputRange: [-15, 15], outputRange: ["-15deg", "15deg"] }) }, { rotateY: tiltY.interpolate({ inputRange: [-15, 15], outputRange: ["-15deg", "15deg"] }) }],
          }}
        >
          <View style={{ alignItems: "center" }}>
            <Image
              source={ship.image}
              style={{
                width: SHIP_SIZE,
                height: SHIP_SIZE,
                opacity: ship.unlocked ? 1 : 0.3,
              }}
              resizeMode="contain"
            />
            {!ship.unlocked && (
              <View style={{
                position: "absolute",
                top: 0, left: 0, right: 0, bottom: 0,
                alignItems: "center",
                justifyContent: "center",
              }}>
                <Feather name="lock" size={28} color="rgba(255,255,255,0.6)" />
              </View>
            )}
          </View>
        </Animated.View>

        {/* Right arrow */}
        <Feather
          name="chevron-right"
          size={28}
          color={index < SHIPS.length - 1 ? "rgba(255,255,255,0.6)" : "rgba(255,255,255,0.15)"}
        />
      </View>

      {/* Ship name */}
      <Text style={{
        color: ship.unlocked ? "#fff" : "rgba(255,255,255,0.4)",
        fontSize: 14,
        fontWeight: "600",
        letterSpacing: 1.5,
        marginTop: 8,
      }}>
        {ship.name}{!ship.unlocked ? " 🔒" : ""}
      </Text>

      {/* Dots */}
      <View style={{ flexDirection: "row", gap: 6, marginTop: 8 }}>
        {SHIPS.map((_, i) => (
          <View
            key={i}
            style={{
              width: i === index ? 16 : 6,
              height: 6,
              borderRadius: 3,
              backgroundColor: i === index ? "#7c4dff" : "rgba(255,255,255,0.2)",
            }}
          />
        ))}
      </View>
    </View>
  );
}
