import { FISH } from './fishing';
// Microdex view-model: one card per feature, grouped by biome. Pure so the UI and tests share it. Owner: Person D.
import { BiomeSchema, type Biome, type Feature, type GameData, type GameState } from './schema';

export interface DexCard {
  feature: Feature;
  sampleId: string;
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
          sampleId: s.id,
          sampleName: s.name,
          found: state.discoveries.includes(feature.id),
          snapshot: state.snapshots[feature.id]?.image,
        })),
      );
    const found = cards.filter((c) => c.found).length;
    return { biome, cards, found, locked: cards.length === 0, complete: cards.length > 0 && found === cards.length };
  });
}

/** Older saves also identify catches from existing stock, samples and discoveries. */
export function fishMicrodex(data: Pick<GameData, 'samples'>, state: Pick<GameState, 'economy' | 'carriedSamples' | 'discoveries'>) {
  return FISH.map(fish => {
    const sampleId = `fish_${fish.id}`;
    const sample = data.samples[sampleId];
    const stock = state.economy.fish[fish.id] ?? 0;
    const prepared = state.carriedSamples.includes(sampleId);
    const found = sample?.features.filter(f => state.discoveries.includes(f.id)).length ?? 0;
    return { ...fish, sampleId, stock, prepared, caught: state.economy.caughtFish.includes(fish.id) || stock > 0 || prepared || found > 0, found, total: sample?.features.length ?? 0 };
  });
}
