// Microdex view-model: one card per feature, grouped by biome. Pure so the UI and tests share it. Owner: Person D.
import { BiomeSchema, type Biome, type Feature, type GameData, type GameState } from './schema';

export interface DexCard {
  feature: Feature;
  sampleName: string;
  found: boolean;
  snapshot?: string;
}

export interface DexBiome {
  biome: Biome;
  cards: DexCard[];
  found: number;
  /** A biome with no authored samples is a locked area (DESIGN.md: other biomes are shown locked). */
  locked: boolean;
  complete: boolean;
}

export function microdex(data: Pick<GameData, 'samples'>, state: Pick<GameState, 'discoveries' | 'snapshots'>): DexBiome[] {
  return BiomeSchema.options.map((biome) => {
    const cards: DexCard[] = Object.values(data.samples)
      .filter((s) => s.biome === biome)
      .flatMap((s) =>
        s.features.map((feature) => ({
          feature,
          sampleName: s.name,
          found: state.discoveries.includes(feature.id),
          snapshot: state.snapshots[feature.id]?.image,
        })),
      );
    const found = cards.filter((c) => c.found).length;
    return { biome, cards, found, locked: cards.length === 0, complete: cards.length > 0 && found === cards.length };
  });
}
