import "../global.css";
import { Stack } from "expo-router";
import { AudioSettingsProvider } from "../context/AudioSettingsContext";

export default function RootLayout() {
  return (
    <AudioSettingsProvider>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="modes" />
        <Stack.Screen name="game" />
        <Stack.Screen name="options" />
        <Stack.Screen name="signin" />
      </Stack>
    </AudioSettingsProvider>
  );
}
