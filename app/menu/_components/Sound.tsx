import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { StatusBar } from "expo-status-bar";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useAudioSettings } from "../../../context/AudioSettingsContext";

function VolumeSlider({
  label,
  value,
  onChange,
  color,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  color: string;
}) {
  const pct = Math.round(value * 100);
  return (
    <View className="py-3">
      <View className="flex-row justify-between mb-[10px]">
        <Text className="text-white text-[18px] font-bold">{label}</Text>
        <Text className="text-white/50 text-[16px] font-semibold">{pct}%</Text>
      </View>
      <View className="h-7 rounded-[14px] bg-white/10 overflow-hidden relative">
        <View
          className="absolute left-0 top-0 bottom-0 rounded-[14px]"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
        <View className="absolute inset-0 flex-row">
          {Array.from({ length: 21 }, (_, i) => (
            <TouchableOpacity
              key={i}
              className="flex-1"
              onPress={() => onChange(i / 20)}
              activeOpacity={0.7}
            />
          ))}
        </View>
      </View>
      <View className="flex-row justify-center mt-2 gap-4">
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-white/[0.12] items-center justify-center"
          onPress={() => onChange(Math.max(0, value - 0.05))}
        >
          <Text className="text-white text-[20px] font-bold">−</Text>
        </TouchableOpacity>
        <TouchableOpacity
          className="w-9 h-9 rounded-full bg-white/[0.12] items-center justify-center"
          onPress={() => onChange(Math.min(1, value + 0.05))}
        >
          <Text className="text-white text-[20px] font-bold">+</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

export default function OptionsScreen() {
  const { musicVolume, sfxVolume, setMusicVolume, setSfxVolume } = useAudioSettings();

  return (
    <LinearGradient colors={["#0f0c29", "#302b63", "#24243e"]} className="flex-1 items-center justify-center p-6">
      <StatusBar style="light" />

      <Text className="text-[36px] font-black text-white tracking-[6px] mb-12">OPTIONS</Text>

      <View className="w-full max-w-[360px] bg-white/[0.08] rounded-2xl p-5">
        <VolumeSlider
          label="Music"
          value={musicVolume}
          onChange={setMusicVolume}
          color="#6c5ce7"
        />

        <View className="h-px bg-white/10 my-1" />

        <VolumeSlider
          label="Sound Effects"
          value={sfxVolume}
          onChange={setSfxVolume}
          color="#00cec9"
        />
      </View>

      <TouchableOpacity className="mt-10 bg-[#636e72] px-10 py-3.5 rounded-xl" onPress={() => router.back()}>
        <Text className="text-white text-[18px] font-bold tracking-[1px]">Back</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}
