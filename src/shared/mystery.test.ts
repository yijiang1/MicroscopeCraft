import { describe, expect, it } from 'vitest';
import {
  assessClaim, BEAM_BUDGET, beamSpent, CANDIDATES, compatibleCandidates, measurements,
  mysteryAdvice, newMystery, parseMystery, spacingNm, takeScan,
} from './mystery';

describe('mystery diffraction investigations', () => {
  it('uses cubic plane spacings and an interpolated alloy between Cu and Ni', () => {
    expect(spacingNm('copper', '200')).toBeCloseTo(0.180765, 6);
    expect(spacingNm('nickel', '111')).toBeCloseTo(0.2034467, 6);
    expect(spacingNm('alloy', '111')).toBeCloseTo((spacingNm('copper', '111') + spacingNm('nickel', '111')) / 2, 10);
  });

  it('leaves the survey ambiguous and makes every candidate solvable within budget across cartridge seeds', () => {
    const identified = new Set<string>();
    for (let seed = 0; seed < 300; seed++) {
      let run = takeScan(newMystery(seed), 'survey', 'copper');
      let evidence = measurements(run);
      expect(compatibleCandidates(evidence).length).toBeGreaterThan(1);
      for (const c of CANDIDATES) expect(assessClaim(run, c.id, evidence.map((m) => m.id)).accepted).toBe(false);
      run = takeScan(takeScan(run, 'fine111', 'nickel'), 'fine200', 'alloy');
      evidence = measurements(run);
      const matches = compatibleCandidates(evidence);
      expect(matches).toHaveLength(1);
      identified.add(matches[0]!.id);
      expect(beamSpent(run)).toBe(BEAM_BUDGET);
      expect(assessClaim(run, matches[0]!.id, evidence.map((m) => m.id)).accepted).toBe(true);
      for (const c of CANDIDATES.filter((c) => c.id !== matches[0]!.id)) {
        expect(assessClaim(run, c.id, evidence.map((m) => m.id)).accepted).toBe(false);
      }
    }
    expect(identified.size).toBe(3);
  });

  it('requires independent plane families, rejects invented evidence, and does not reward a lucky guess', () => {
    const run = takeScan(newMystery(19), 'fine111', 'alloy');
    const evidence = measurements(run);
    const correct = compatibleCandidates(evidence)[0]!.id;
    expect(assessClaim(newMystery(19), correct, []).accepted).toBe(false);
    expect(assessClaim(run, correct, [evidence[0]!.id, evidence[0]!.id]).accepted).toBe(false);
    expect(assessClaim(run, correct, [evidence[0]!.id, 'fine200-200']).accepted).toBe(false);
    expect(mysteryAdvice(run)).toContain('other plane family');
  });

  it('keeps predictions as history without allowing them to influence observations', () => {
    const a = takeScan(newMystery(27), 'fine111', 'copper');
    const b = takeScan(newMystery(27), 'fine111', 'nickel');
    expect(measurements(a)[0]!.dNm).toBe(measurements(b)[0]!.dNm);
    expect(measurements(a)[0]!.prediction).toBe('copper');
    expect(measurements(b)[0]!.prediction).toBe('nickel');
    expect(takeScan(a, 'fine111', 'alloy')).toBe(a);
    expect(beamSpent(a)).toBe(3);
  });

  it('restores partial and completed notebooks by replay, but rejects corrupt or fabricated completion', () => {
    let run = takeScan(takeScan(newMystery(4), 'fine200', 'nickel'), 'fine111', 'alloy');
    expect(parseMystery(JSON.stringify(run))).toEqual(run);
    const evidence = measurements(run);
    const id = compatibleCandidates(evidence)[0]!.id;
    run = { ...run, conclusion: { candidate: id, evidence: evidence.map((m) => m.id) } };
    expect(parseMystery(JSON.stringify(run))).toEqual(run);
    expect(takeScan(run, 'survey', 'copper')).toBe(run);
    expect(parseMystery(JSON.stringify({ ...newMystery(4), conclusion: run.conclusion }))).toBeNull();
    for (const raw of ['garbage', 'null', '{}', '{"version":99}', JSON.stringify({ ...run, scans: [run.scans[0], run.scans[0]] }), JSON.stringify({ ...run, seed: -1 }), JSON.stringify({ ...run, scans: [{ scanId: 'bogus', prediction: 'copper' }] })]) {
      expect(parseMystery(raw)).toBeNull();
    }
  });
});
