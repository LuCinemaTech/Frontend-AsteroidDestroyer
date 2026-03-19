import React from "react";
import { View, Image } from "react-native";
import type { GameState } from "../_shared/types";
import { BOSS_ASTEROID_IMAGES } from "../_shared/constants";

// ── Boss render (boss collision logic is in Asteroid.tsx updateAsteroids) ──

interface AsteroidBossProps {
  asteroids: GameState["asteroids"];
  ts: number;
}

export default function AsteroidBoss({ asteroids, ts }: AsteroidBossProps) {
  return (
    <>
      {asteroids
        .filter((a) => a.isBoss && a.radius > 0)
        .map((a) => {
          const sz = a.radius * 2;
          const curSprite = a.sprite % BOSS_ASTEROID_IMAGES.length;
          const img = BOSS_ASTEROID_IMAGES[curSprite];
          const flashActive = a.bossFlash && ts - a.bossFlash < 120;
          const dmgProgress = (a.bossDmg ?? 0) / (a.bossDmgMax ?? 1);
          const nextSprite = curSprite + 1;
          const hasNext = nextSprite < BOSS_ASTEROID_IMAGES.length;
          const nextImg = hasNext ? BOSS_ASTEROID_IMAGES[nextSprite] : null;
          return (
            <React.Fragment key={a.id}>
              {/* Current sprite — always solid */}
              <Image
                source={img}
                style={{
                  position: "absolute",
                  left: a.x - a.radius,
                  top: a.y - a.radius,
                  width: sz,
                  height: sz,
                  transform: [{ rotate: `${a.rotation}rad` }],
                  tintColor: flashActive ? "#ff6b6b" : undefined,
                }}
                resizeMode="contain"
              />
              {/* Next sprite — fades in as damage accumulates */}
              {hasNext && nextImg && dmgProgress > 0 && (
                <Image
                  source={nextImg}
                  style={{
                    position: "absolute",
                    left: a.x - a.radius,
                    top: a.y - a.radius,
                    width: sz,
                    height: sz,
                    transform: [{ rotate: `${a.rotation}rad` }],
                    opacity: dmgProgress,
                    tintColor: flashActive ? "#ff6b6b" : undefined,
                  }}
                  resizeMode="contain"
                />
              )}
              {/* HP bar — shows remaining toughness in current phase */}
              {a.bossDmgMax !== undefined && (
                <View
                  style={{
                    position: "absolute",
                    left: a.x - 25,
                    top: a.y - a.radius - 12,
                    width: 50,
                    height: 6,
                    backgroundColor: "rgba(0,0,0,0.5)",
                    borderRadius: 3,
                  }}
                >
                  <View
                    style={{
                      width: `${((a.bossDmgMax - (a.bossDmg ?? 0)) / a.bossDmgMax) * 100}%`,
                      height: "100%",
                      backgroundColor: "#ff6b6b",
                      borderRadius: 3,
                    }}
                  />
                </View>
              )}
            </React.Fragment>
          );
        })}
    </>
  );
}
