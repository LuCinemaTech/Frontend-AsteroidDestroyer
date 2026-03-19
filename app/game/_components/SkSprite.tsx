import React from "react";
import {
  Group,
  Rect,
  ImageShader,
  ColorMatrix,
} from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";

// Tint matrix: turns all pixels to a solid color with original alpha
export const tintMatrix = (r: number, g: number, b: number, a: number) => [
  0, 0, 0, 0, r / 255,
  0, 0, 0, 0, g / 255,
  0, 0, 0, 0, b / 255,
  0, 0, 0, a, 0,
];

// Helper to draw a rotated Skia image centered at (cx, cy)
export const SkSprite = ({ img, cx, cy, w, h, angle, opacity, tint }: {
  img: SkImage | null; cx: number; cy: number; w: number; h: number;
  angle?: number; opacity?: number; tint?: [number, number, number];
}) => {
  if (!img) return null;
  return (
    <Group
      transform={[{ translateX: cx }, { translateY: cy }, { rotate: angle ?? 0 }, { translateX: -w / 2 }, { translateY: -h / 2 }]}
      opacity={opacity}
    >
      <Rect x={0} y={0} width={w} height={h}>
        <ImageShader image={img} fit="fill" x={0} y={0} width={w} height={h} fm="linear" mm="linear" />
        {tint && <ColorMatrix matrix={tintMatrix(tint[0], tint[1], tint[2], 1)} />}
      </Rect>
    </Group>
  );
};
