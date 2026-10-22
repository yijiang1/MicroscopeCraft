import {
  assessClaim, CANDIDATES, MYSTERY_QUEST_ID, MYSTERY_SAMPLE_ID, mysterySample, newMystery,
  SCANS, takeScan, type CandidateId, type ScanId,
} from './mystery';
import { bump, carrySample, completeQuest, ownedScopes, type GameContext } from './state';
import { scopeResolutionUm } from './sim/optics';

export const nearBragg = (ctx: GameContext) => {
  const p = ctx.state.playerLocation;
  const npc = ctx.data.npcs.bragg;
  return !!p && !!npc && Math.hypot(p.x - npc.x, p.z - npc.z) <= 10;
};

export function acceptMystery(ctx: GameContext, seed: number): boolean {
  if (!nearBragg(ctx) || (ctx.state.mystery && !ctx.state.mystery.conclusion)) return false;
  ctx.state.mystery = newMystery(seed);
  carrySample(ctx, MYSTERY_SAMPLE_ID);
  ctx.bus.emit('mysteryChanged', {});
  return true;
}

export function predictMystery(ctx: GameContext, id: CandidateId) {
  const run = ctx.state.mystery;
  if (!run || run.conclusion || !CANDIDATES.some((c) => c.id === id)) return;
  ctx.state.mystery = { ...run, prediction: id };
  ctx.bus.emit('mysteryChanged', {});
}

export function missionSample(ctx: GameContext, id: string) {
  return id === MYSTERY_SAMPLE_ID && ctx.state.mystery ? mysterySample(ctx.state.mystery) : ctx.data.samples[id];
}

/** Rechecked at acquisition, not just by disabling UI controls. No notebook or off-site measurements. */
export function mysteryScanBlock(ctx: GameContext): string | null {
  const { state } = ctx;
  if (!state.mystery) return 'Accept the unknown-sample mission from Bragg in Wilson Lab first.';
  if (state.mystery.conclusion) return 'This investigation is complete. Return to Bragg for another sample.';
  if (state.currentSampleId !== MYSTERY_SAMPLE_ID || !state.carriedSamples.includes(MYSTERY_SAMPLE_ID)) return 'Load Bragg’s unknown powder into a microscope you have built.';
  const instrument = ownedScopes(state.inventory, ctx.data, state.site).find((r) => r.scope.tier === state.scope.tier);
  if (!instrument?.scope.site || instrument.scope.site !== state.site || state.scope.site !== state.site) return 'Use your built TEM or STEM in the science lab, or your CHESS beamline in Wilson Lab.';
  const step = state.scope.steps[state.scope.step];
  if (!step || step.mode !== state.scope.mode || !instrument.scope.steps.some((s) => s.mode === state.scope.mode)) return 'Choose a diffraction mode on your instrument.';
  if (!((state.scope.mode === 'ediff' && state.site === 'lab') || (state.scope.mode === 'xrd' && state.site === 'chess'))) return 'Switch to Electron diffraction or X-ray diffraction using the instrument controls below.';
  if (scopeResolutionUm(state.scope) > 0.176 / 1000) return 'This detector setting cannot record both required plane spacings.';
  if (!state.mystery.prediction) return 'Choose a working hypothesis before recording a measurement.';
  return null;
}

export function recordMysteryScan(ctx: GameContext, scanId: ScanId): boolean {
  if (mysteryScanBlock(ctx) || !SCANS.some((s) => s.id === scanId)) return false;
  const run = ctx.state.mystery!;
  const next = takeScan(run, scanId, run.prediction!);
  if (next === run) return false;
  const instrument = ownedScopes(ctx.state.inventory, ctx.data, ctx.state.site).find((r) => r.scope.tier === ctx.state.scope.tier)!;
  next.scans[next.scans.length - 1]!.instrument = {
    name: instrument.name, tier: ctx.state.scope.tier,
    mode: ctx.state.scope.mode as 'ediff' | 'xrd', site: ctx.state.site as 'lab' | 'chess',
  };
  ctx.state.mystery = next;
  ctx.bus.emit('mysteryChanged', {});
  return true;
}

export function submitMystery(ctx: GameContext, id: CandidateId, evidence: string[]) {
  const run = ctx.state.mystery;
  if (!run || !nearBragg(ctx)) return { accepted: false, text: 'Return to Bragg in Wilson Lab and present your conclusion in his dialogue.' };
  if (run.conclusion) return { accepted: false, text: 'Bragg has already accepted this investigation.' };
  const result = assessClaim(run, id, evidence);
  if (result.accepted) {
    ctx.state.mystery = { ...run, conclusion: { candidate: id, evidence } };
    bump(ctx, 'mystery_identified');
    completeQuest(ctx, 'bragg', MYSTERY_QUEST_ID);
    ctx.bus.emit('mysteryChanged', {});
  }
  return result;
}
