// A closed-set, educational diffraction investigation. No DOM or model calls.
// Cu/Ni room-temperature lattice constants and approximate linear alloy interpolation:
// https://www.copper.org/applications/marine/cuni/properties/DKI_booklet.php
// FCC reflections and cubic spacings: IUCr, H. Lipson, The study of metals and alloys
// by X-ray powder diffraction methods. Sources and simplifications also appear in the UI.
import type { Sample } from './schema';

/** Kept only so Restart game can also remove the old standalone prototype's notebook. */
export const MYSTERY_SAVE_KEY = 'microscopecraft:mystery:v1';
export const MYSTERY_SAMPLE_ID = 'bragg_unknown';
export const MYSTERY_QUEST_ID = 'bg_mystery';
export const BEAM_BUDGET = 8;
export const CANDIDATES = [
  { id: 'copper', name: 'Copper', formula: 'Cu', latticeNm: 0.36153 },
  { id: 'nickel', name: 'Nickel', formula: 'Ni', latticeNm: 0.35238 },
  { id: 'alloy', name: 'Copper–nickel alloy', formula: '50:50 atomic Cu:Ni', latticeNm: (0.36153 + 0.35238) / 2 },
] as const;
export type CandidateId = typeof CANDIDATES[number]['id'];
export type Reflection = '111' | '200';
export const SCANS = [
  { id: 'survey', name: 'Quick survey', cost: 2, toleranceNm: 0.006, reflections: ['111', '200'], description: 'Locate both peaks. Fast, but the broad measurement bounds may leave several candidates.' },
  { id: 'fine111', name: 'Precision scan · (111)', cost: 3, toleranceNm: 0.0003, reflections: ['111'], description: 'Measure the first peak precisely. Can it separate the three candidates?' },
  { id: 'fine200', name: 'Precision scan · (200)', cost: 3, toleranceNm: 0.0003, reflections: ['200'], description: 'Measure a different family of planes to check your interpretation.' },
] as const;
export type ScanId = typeof SCANS[number]['id'];
export interface Measurement {
  id: string;
  scanId: ScanId;
  reflection: Reflection;
  dNm: number;
  toleranceNm: number;
  prediction: CandidateId;
}
export interface MysteryRun {
  version: 2;
  seed: number;
  prediction?: CandidateId;
  scans: { scanId: ScanId; prediction: CandidateId; instrument?: { name: string; tier: number; mode: 'ediff' | 'xrd'; site: 'lab' | 'chess' } }[];
  conclusion?: { candidate: CandidateId; evidence: string[] };
}

export const candidate = (id: CandidateId) => CANDIDATES.find((c) => c.id === id)!;
export const spacingNm = (id: CandidateId, reflection: Reflection) => candidate(id).latticeNm / Math.sqrt(reflection === '111' ? 3 : 4);
const validCandidate = (id: unknown): id is CandidateId => CANDIDATES.some((c) => c.id === id);
const validScan = (id: unknown): id is ScanId => SCANS.some((s) => s.id === id);
const hash = (seed: number) => {
  let x = seed | 0;
  x ^= x << 13;
  x ^= x >>> 17;
  x ^= x << 5;
  return x >>> 0;
};
export const newMystery = (seed: number): MysteryRun => ({ version: 2, seed: seed >>> 0, scans: [] });
export const beamSpent = (run: MysteryRun) => run.scans.reduce((sum, s) => sum + SCANS.find((scan) => scan.id === s.scanId)!.cost, 0);

/** Truth stays out of the presentation and coaching API; observations alone guide the player. */
export function measurements(run: MysteryRun): Measurement[] {
  const material = CANDIDATES[hash(run.seed) % CANDIDATES.length]!;
  return run.scans.flatMap((entry) => {
    const scan = SCANS.find((s) => s.id === entry.scanId)!;
    return scan.reflections.map((reflection) => {
      // Bounded, repeatable synthetic error. These are hard model bounds, not confidence intervals.
      const noise = (hash(run.seed + (reflection === '111' ? 71 : 137) + scan.cost) / 0xffffffff - 0.5) * scan.toleranceNm;
      return { id: `${scan.id}-${reflection}`, scanId: scan.id, reflection, dNm: spacingNm(material.id, reflection) + noise, toleranceNm: scan.toleranceNm, prediction: entry.prediction };
    });
  });
}

/** A mission specimen is carried, not a collectible in the Microdex. Preparation is supplied by Bragg. */
export function mysterySample(run: MysteryRun): Sample {
  const material = CANDIDATES[hash(run.seed) % CANDIDATES.length]!;
  return {
    id: MYSTERY_SAMPLE_ID, name: 'Bragg’s unknown powder', worldObject: 'crystal', biome: 'lab',
    features: [
      { id: 'mystery_grains', name: 'Unidentified metal grains', sizeUm: 12, contrast: 0.6, contrastIn: {}, drawing: 'grains', tint: '#bbbbbb', onTop: false, blurb: 'The grain shape does not identify the material. Measure its crystal spacings instead.' },
      { id: 'mystery_rings', name: 'Unknown FCC diffraction rings', sizeUm: spacingNm(material.id, '111') / 1000, contrast: 0, contrastIn: { ediff: 0.9, xrd: 0.9 }, drawing: 'rings', onTop: false, blurb: 'The ring radii encode lattice-plane spacings. Record measurements to compare the candidate materials.' },
    ],
  };
}
export const supports = (m: Measurement, id: CandidateId) => Math.abs(m.dNm - spacingNm(id, m.reflection)) <= m.toleranceNm;
export const compatibleCandidates = (evidence: Measurement[]) => CANDIDATES.filter((c) => evidence.every((m) => supports(m, c.id)));

export function takeScan(run: MysteryRun, scanId: ScanId, prediction: CandidateId): MysteryRun {
  const scan = SCANS.find((s) => s.id === scanId);
  if (!scan || !validCandidate(prediction) || run.conclusion || run.scans.some((s) => s.scanId === scanId) || beamSpent(run) + scan.cost > BEAM_BUDGET) return run;
  return { ...run, scans: [...run.scans, { scanId, prediction }] };
}

export function assessClaim(run: MysteryRun, id: CandidateId, evidenceIds: string[]): { accepted: boolean; text: string } {
  const all = measurements(run);
  const evidence = all.filter((m) => evidenceIds.includes(m.id));
  if (!validCandidate(id)) return { accepted: false, text: 'Choose a candidate for your conclusion.' };
  if (evidenceIds.some((key) => !all.some((m) => m.id === key)) || new Set(evidence.map((m) => m.reflection)).size < 2) {
    return { accepted: false, text: 'Cite measurements of both (111) and (200). Repeating the same peak is not an independent structural check.' };
  }
  if (!evidence.every((m) => supports(m, id))) return { accepted: false, text: 'At least one cited peak disagrees with this candidate outside its measurement bound. Compare the reference spacings and revise your conclusion.' };
  const remaining = compatibleCandidates(evidence);
  if (remaining.length !== 1) return { accepted: false, text: `Your evidence still fits ${remaining.length} candidates. A precision scan can narrow the possibilities; a plausible guess is not yet a supported identification.` };
  return { accepted: true, text: `Case solved: ${candidate(id).name}. Both plane families support your conclusion, and your cited evidence rules out the other candidates in this model.` };
}

/** Deterministic coaching, grounded only in the measurements the player has made. */
export function mysteryAdvice(run: MysteryRun): string {
  const evidence = measurements(run);
  if (run.conclusion) return 'A defensible identification needs a prediction, measurements, and a check against alternatives. Try a new cartridge to test that reasoning again.';
  if (!evidence.length) return 'The three candidates share a face-centred cubic structure. Predict their peak spacings, then choose a scan. Smaller bounds distinguish closer spacings; a second plane family checks the result.';
  const remaining = compatibleCandidates(evidence);
  if (remaining.length > 1) return `${remaining.length} candidates still fit the observations. The survey alone cannot identify this cartridge. Compare the reference spacings with the measurement bounds before choosing a precision scan.`;
  if (new Set(evidence.map((m) => m.reflection)).size < 2) return 'One candidate fits this peak. Now measure the other plane family: a second reflection checks whether the same crystal model explains both.';
  return 'Your observations distinguish one candidate. Compare both plane families with the reference card, select the evidence you want to cite, and submit your conclusion.';
}

/** Replay saved actions instead of trusting saved readings, costs, or a completion flag. */
export function parseMystery(raw: string | null): MysteryRun | null {
  if (!raw) return null;
  try {
    const value = JSON.parse(raw);
    if (!value || value.version !== 2 || !Number.isInteger(value.seed) || value.seed < 0 || value.seed > 0xffffffff || !Array.isArray(value.scans) || value.scans.length > SCANS.length) return null;
    let run = newMystery(value.seed);
    for (const s of value.scans) {
      if (!s || !validScan(s.scanId) || !validCandidate(s.prediction)) return null;
      const next = takeScan(run, s.scanId, s.prediction);
      if (next === run) return null;
      run = next;
      if (s.instrument !== undefined) {
        const i = s.instrument;
        if (!i || typeof i.name !== 'string' || !((i.mode === 'ediff' && i.site === 'lab' && [5, 6].includes(i.tier)) || (i.mode === 'xrd' && i.site === 'chess' && i.tier === 7))) return null;
        run.scans[run.scans.length - 1]!.instrument = { name: i.name, tier: i.tier, mode: i.mode, site: i.site };
      }
    }
    if (value.prediction !== undefined) {
      if (!validCandidate(value.prediction)) return null;
      run.prediction = value.prediction;
    }
    if (value.conclusion !== undefined) {
      const c = value.conclusion;
      if (!c || !validCandidate(c.candidate) || !Array.isArray(c.evidence) || !c.evidence.every((e: unknown) => typeof e === 'string') || !assessClaim(run, c.candidate, c.evidence).accepted) return null;
      run = { ...run, conclusion: { candidate: c.candidate, evidence: [...new Set<string>(c.evidence)] } };
    }
    return run;
  } catch { return null; }
}
