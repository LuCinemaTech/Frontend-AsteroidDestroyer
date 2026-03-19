import React, { useEffect, useState } from "react";
import { Platform, View, Text, ScrollView, Alert } from "react-native";
import { useLocalSearchParams } from "expo-router";
import type { GameModeConfig } from "./_shared/types";

// Catch ALL uncaught JS errors (including those error boundaries miss)
const errorLog: string[] = [];

if (Platform.OS !== "web") {
  const g = global as any;
  // Catch uncaught JS exceptions
  if (g.ErrorUtils) {
    const prev = g.ErrorUtils.getGlobalHandler();
    g.ErrorUtils.setGlobalHandler((error: any, isFatal: boolean) => {
      const msg = `[${isFatal ? "FATAL" : "ERROR"}] ${error?.message ?? error}\n${error?.stack?.slice(0, 400) ?? ""}`;
      errorLog.push(msg);
      try { Alert.alert("Game Error", msg); } catch {}
      if (prev) prev(error, isFatal);
    });
  }
  // Catch unhandled promise rejections
  const tracking = require("promise/setimmediate/rejection-tracking");
  tracking.enable({
    allRejections: true,
    onUnhandled: (_id: number, error: any) => {
      const msg = `[Promise] ${error?.message ?? error}\n${error?.stack?.slice(0, 400) ?? ""}`;
      errorLog.push(msg);
      try { Alert.alert("Unhandled Promise", msg); } catch {}
    },
  });
}

class GameErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { error: Error | null }
> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) { return { error }; }
  render() {
    if (this.state.error) {
      return (
        <View style={{ flex: 1, backgroundColor: "#1a0000", padding: 24, justifyContent: "center" }}>
          <Text style={{ color: "#ff6b6b", fontSize: 20, fontWeight: "bold", marginBottom: 12 }}>
            Game Crashed
          </Text>
          <ScrollView style={{ maxHeight: 400 }}>
            <Text style={{ color: "#ffaaaa", fontSize: 13 }}>
              {this.state.error.message}
            </Text>
            <Text style={{ color: "#ff8888", fontSize: 11, marginTop: 8 }}>
              {this.state.error.stack?.slice(0, 800)}
            </Text>
            {errorLog.length > 0 && (
              <Text style={{ color: "#ffcc88", fontSize: 11, marginTop: 12 }}>
                Additional errors:{"\n"}{errorLog.join("\n---\n")}
              </Text>
            )}
          </ScrollView>
        </View>
      );
    }
    return this.props.children;
  }
}

function Game() {
  const [Comp, setComp] = useState<React.ComponentType<{ modeConfig?: GameModeConfig }> | null>(null);
  const params = useLocalSearchParams<{ modeConfig?: string }>();
  const modeConfig: GameModeConfig | undefined = params.modeConfig
    ? JSON.parse(params.modeConfig)
    : undefined;

  useEffect(() => {
    if (Platform.OS === "web") {
      (async () => {
        try {
          // 1. Load & init CanvasKit WASM — must complete before any Skia render
          const { LoadSkiaWeb } = await import(
            "@shopify/react-native-skia/lib/module/web/LoadSkiaWeb" as any
          );
          await LoadSkiaWeb();
          // 2. CanvasKit is now on global — safe to render Skia components
          const { default: AD } = await import("./AsteroidDestroyer");
          setComp(() => AD);
        } catch (e) {
          console.error("Failed to load CanvasKit:", e);
        }
      })();
    } else {
      const AD = require("./AsteroidDestroyer").default;
      setComp(() => AD);
    }
  }, []);

  if (!Comp) {
    return (
      <View style={{ flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center" }}>
        <Text style={{ color: "#fff", fontSize: 18 }}>Loading…</Text>
      </View>
    );
  }

  return (
    <GameErrorBoundary>
      <Comp modeConfig={modeConfig} />
    </GameErrorBoundary>
  );
}

export default Game;
