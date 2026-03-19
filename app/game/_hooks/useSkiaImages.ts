import { useImage } from "@shopify/react-native-skia";
import type { SkImage } from "@shopify/react-native-skia";

export function useSkiaImages() {
  const imgBg = useImage(require("../../../assets/images/Menus/Space-Background.png"));
  const imgShipSB = useImage(require("../../../assets/images/Starships/Ship-SilverBlue.png"));
  const imgShipBR = useImage(require("../../../assets/images/Starships/Ship-BlackRed.png"));
  const imgShipGold = useImage(require("../../../assets/images/Starships/Ship-Gold.png"));
  const imgShipAB = useImage(require("../../../assets/images/Starships/Ship-AlienBlue.png"));
  const imgShipAR = useImage(require("../../../assets/images/Starships/Ship-AlienRed.png"));
  const imgPhotonBlue = useImage(require("../../../assets/images/Weapons/Photon-Blaster-Blue.png"));
  const imgWaveArc = useImage(require("../../../assets/images/Weapons/Wave-arc.gif"));
  const imgSatellite = useImage(require("../../../assets/images/Drones/Satelite-Drone01.png"));
  const imgSatGold = useImage(require("../../../assets/images/Drones/Satelite-Drone01-Gold.png"));

  const imgEarth = [
    useImage(require("../../../assets/images/Level 1 - 10/Earth/Earth01.png")),
    useImage(require("../../../assets/images/Level 1 - 10/Earth/Earth02.png")),
    useImage(require("../../../assets/images/Level 1 - 10/Earth/Earth03.png")),
    useImage(require("../../../assets/images/Level 1 - 10/Earth/Earth04.png")),
  ];
  const imgEarthGold = useImage(require("../../../assets/images/Level 1 - 10/Earth/Earth-Gold.png"));

  const imgMoon = [
    useImage(require("../../../assets/images/Level 11 - 20/Moon01.png")),
    useImage(require("../../../assets/images/Level 11 - 20/Moon02.png")),
    useImage(require("../../../assets/images/Level 11 - 20/Moon03.png")),
    useImage(require("../../../assets/images/Level 11 - 20/Moon04.png")),
  ];

  const imgMercury = [
    useImage(require("../../../assets/images/Level 21 - 30/Mercury01.png")),
    useImage(require("../../../assets/images/Level 21 - 30/Mercury02.png")),
    useImage(require("../../../assets/images/Level 21 - 30/Mercury03.png")),
    useImage(require("../../../assets/images/Level 21 - 30/Mercury04.png")),
  ];

  const imgVenus = [
    useImage(require("../../../assets/images/Level 31 - 40/Venus01.png")),
    useImage(require("../../../assets/images/Level 31 - 40/Venus02.png")),
    useImage(require("../../../assets/images/Level 31 - 40/Venus03.png")),
    useImage(require("../../../assets/images/Level 31 - 40/Venus04.png")),
  ];

  const imgMars = [
    useImage(require("../../../assets/images/Level 41 - 50/Mars01.png")),
    useImage(require("../../../assets/images/Level 41 - 50/Mars02.png")),
    useImage(require("../../../assets/images/Level 41 - 50/Mars03.png")),
    useImage(require("../../../assets/images/Level 41 - 50/Mars04.png")),
  ];

  const imgJupiter = [
    useImage(require("../../../assets/images/Level 51 -60/Jupiter01.png")),
    useImage(require("../../../assets/images/Level 51 -60/Jupiter02.png")),
    useImage(require("../../../assets/images/Level 51 -60/Jupiter03.png")),
    useImage(require("../../../assets/images/Level 51 -60/Jupiter04.png")),
  ];

  const imgSaturn = [
    useImage(require("../../../assets/images/Level 61 - 70/Saturn01.png")),
    useImage(require("../../../assets/images/Level 61 - 70/Saturn02.png")),
    useImage(require("../../../assets/images/Level 61 - 70/Saturn03.png")),
    useImage(require("../../../assets/images/Level 61 - 70/Saturn04.png")),
  ];

  const imgUranus = [
    useImage(require("../../../assets/images/Level 71 - 80/Uranus01.png")),
    useImage(require("../../../assets/images/Level 71 - 80/Uranus02.png")),
    useImage(require("../../../assets/images/Level 71 - 80/Uranus03.png")),
    useImage(require("../../../assets/images/Level 71 - 80/Uranus04.png")),
  ];

  const imgNeptune = [
    useImage(require("../../../assets/images/Level 81 - 90/Neptune01.png")),
    useImage(require("../../../assets/images/Level 81 - 90/Neptune02.png")),
    useImage(require("../../../assets/images/Level 81 - 90/Neptune03.png")),
    useImage(require("../../../assets/images/Level 81 - 90/Neptune04.png")),
  ];

  const imgPluto = [
    useImage(require("../../../assets/images/Level 91 - 100/Pluto01.png")),
    useImage(require("../../../assets/images/Level 91 - 100/Pluto02.png")),
    useImage(require("../../../assets/images/Level 91 - 100/Pluto03.png")),
    useImage(require("../../../assets/images/Level 91 - 100/Pluto04.png")),
  ];

  const planetImageMap: Record<string, (SkImage | null)[]> = {
    earth: imgEarth, moon: imgMoon, mercury: imgMercury,
    venus: imgVenus, mars: imgMars, jupiter: imgJupiter,
    saturn: imgSaturn, uranus: imgUranus, neptune: imgNeptune, pluto: imgPluto,
  };

  const imgAlienBlue = useImage(require("../../../assets/images/Starships/Ship-AlienBlue.png"));
  const imgAlienRed = useImage(require("../../../assets/images/Starships/Ship-AlienRed.png"));
  const imgAlienDisc = useImage(require("../../../assets/images/Weapons/Plasma-Disc.png"));
  const imgDroneBlue = useImage(require("../../../assets/images/Ekana/Drones/Alien-Drone1a.png"));
  const imgDroneRed = useImage(require("../../../assets/images/Ekana/Drones/Alien-Drone1b.png"));
  const imgBossAlien = useImage(require("../../../assets/images/Ekana/Warship/Ship-ExoticBlue.png"));
  const imgBossAlienAwake = useImage(require("../../../assets/images/Ekana/Warship/Ship-ExoticBlueAwakened.png"));
  const imgBossAlienRed = useImage(require("../../../assets/images/Ekana/Warship/Ship-ExoticRed.png"));
  const imgBossAlienRedAwake = useImage(require("../../../assets/images/Ekana/Warship/Ship-ExoticRedAwakened.png"));

  const imgBrownAst: (SkImage | null)[] = [
    useImage(require("../../../assets/images/Asteroids/Magnetite-Asteroid01.png")),
    useImage(require("../../../assets/images/Asteroids/Magnetite-Asteroid02.png")),
    useImage(require("../../../assets/images/Asteroids/Magnetite-Asteroid03.png")),
  ];
  const imgBlueAst: (SkImage | null)[] = [
    useImage(require("../../../assets/images/Asteroids/Cyro-Silicate-Asteroid01.png")),
    useImage(require("../../../assets/images/Asteroids/Cyro-Silicate-Asteroid02.png")),
    useImage(require("../../../assets/images/Asteroids/Cyro-Silicate-Asteroid03.png")),
  ];
  const imgRedAst: (SkImage | null)[] = [
    useImage(require("../../../assets/images/Asteroids/Hematite-Asteroid01.png")),
    useImage(require("../../../assets/images/Asteroids/Hematite-Asteroid02.png")),
    useImage(require("../../../assets/images/Asteroids/Hematite-Asteroid03.png")),
  ];
  const imgCrystalAst: (SkImage | null)[] = [
    useImage(require("../../../assets/images/Crystals/Diamond-Crystals01.png")),
    useImage(require("../../../assets/images/Crystals/Emerald-Crystals01.png")),
    useImage(require("../../../assets/images/Crystals/Ruby-Crystals01.png")),
  ];
  const imgBoss = [
    useImage(require("../../../assets/images/Asteroids/Ekana-Asteroid01.png")),
    useImage(require("../../../assets/images/Asteroids/Ekana-Asteroid02.png")),
    useImage(require("../../../assets/images/Asteroids/Ekana-Asteroid03.png")),
  ];

  const imgDebris = [
    useImage(require("../../../assets/images/Debris/Metal-Debris01.png")),
    useImage(require("../../../assets/images/Debris/Metal-Debris02.png")),
    useImage(require("../../../assets/images/Debris/Metal-Debris03.png")),
  ];

  const imgPower: Record<string, SkImage | null> = {
    wave: useImage(require("../../../assets/images/Icons/Icon-Wave.png")),
    shield: useImage(require("../../../assets/images/Icons/Icon-Shield.png")),
    missile: useImage(require("../../../assets/images/Icons/Icon-Nuke.png")),
    heal: useImage(require("../../../assets/images/Icons/Icon-Health.png")),
    immortality: useImage(require("../../../assets/images/Icons/Icon-Immortality.png")),
  };

  const astImgMap: Record<string, (SkImage | null)[]> = {
    brown: imgBrownAst, blue: imgBlueAst, red: imgRedAst, crystal: imgCrystalAst,
  };

  const shipImgs: Record<string, SkImage | null> = {
    SilverBlue: imgShipSB, BlackRed: imgShipBR, Gold: imgShipGold,
    AlienBlue: imgShipAB, AlienRed: imgShipAR,
  };

  const ready = !!(imgBg && imgShipSB && imgEarth[1]);

  return {
    imgBg, imgShipGold, imgPhotonBlue, imgWaveArc,
    imgSatellite, imgSatGold,
    imgEarth, imgEarthGold, planetImageMap,
    imgAlienBlue, imgAlienRed, imgAlienDisc,
    imgDroneBlue, imgDroneRed,
    imgBossAlien, imgBossAlienAwake, imgBossAlienRed, imgBossAlienRedAwake,
    imgBrownAst, imgBoss, imgDebris, imgPower,
    astImgMap, shipImgs, ready,
  };
}
