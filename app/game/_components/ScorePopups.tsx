import React from "react";
import { Text } from "react-native";
import type { ScorePopup } from "../_shared/types";

interface ScorePopupsProps {
  scorePopups: ScorePopup[];
}

export const ScorePopups = React.memo(({ scorePopups }: ScorePopupsProps) => (
  <>
    {scorePopups.map(sp => (
      <Text
        key={sp.id}
        style={{
          position: 'absolute',
          left: sp.x - 40,
          top: sp.y - 10,
          width: 80,
          textAlign: 'center',
          color: sp.color,
          fontSize: 14,
          fontWeight: 'bold',
          opacity: sp.life,
          textShadowColor: 'rgba(0,0,0,0.8)',
          textShadowOffset: { width: 1, height: 1 },
          textShadowRadius: 2,
        }}
      >
        +{sp.value}
      </Text>
    ))}
  </>
));
