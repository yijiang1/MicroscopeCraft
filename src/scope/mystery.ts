import { BEAM_BUDGET, beamSpent, CANDIDATES, measurements, MYSTERY_SAMPLE_ID, SCANS, type CandidateId } from '../shared/mystery';
import { mysteryScanBlock, predictMystery, recordMysteryScan } from '../shared/mysteryActions';
import type { GameContext } from '../shared/state';
import { button, el } from './kit';

/** Real instrument controls: only displayed for the carried mission sample in the eyepiece. */
export function mountMysteryAcquisition(host: HTMLElement, ctx: GameContext) {
  const box = el('section', 'position:absolute;right:10px;top:10px;width:min(310px,calc(100% - 20px));max-height:calc(100% - 210px);overflow:auto;padding:12px;box-sizing:border-box;background:#10232aee;border:1px solid #79edcb;border-radius:10px;color:#e9f9f6;font:13px/1.45 system-ui;z-index:4');
  box.setAttribute('aria-label', 'Mystery sample experiment');
  host.append(box);
  const render = () => {
    const run = ctx.state.mystery;
    box.hidden = ctx.state.currentSampleId !== MYSTERY_SAMPLE_ID || !run;
    if (!run || box.hidden) return;
    box.replaceChildren(el('b', '', 'Bragg’s unknown · Record evidence'));
    box.append(el('p', 'margin:6px 0', `${BEAM_BUDGET - beamSpent(run)} beam-time credits left · ${run.scans.length} scans recorded`));
    const label = el('label', '', 'Working hypothesis');
    const select = document.createElement('select');
    select.style.cssText = 'display:block;width:100%;margin:5px 0 8px;padding:7px';
    select.append(new Option('Choose a prediction', ''));
    CANDIDATES.forEach((c) => select.append(new Option(c.name, c.id)));
    select.value = run.prediction ?? '';
    select.disabled = !!run.conclusion;
    select.onchange = () => predictMystery(ctx, select.value as CandidateId);
    select.addEventListener('keydown', (e) => e.stopPropagation());
    label.append(select); box.append(label);
    const block = mysteryScanBlock(ctx);
    box.append(el('p', 'color:#b9dfd4;margin:6px 0', block ?? 'Diffraction detector ready. Record a peak, then compare it with your prediction in the notebook.'));
    for (const scan of SCANS) {
      const done = run.scans.some((s) => s.scanId === scan.id);
      const b = button(`${done ? '✓ ' : ''}${scan.name} · ${scan.cost} credits`, () => recordMysteryScan(ctx, scan.id), 'display:block;width:100%;padding:8px;margin:5px 0;text-align:left');
      b.disabled = !!block || done || beamSpent(run) + scan.cost > BEAM_BUDGET;
      box.append(b);
    }
    const latestScan = run.scans.at(-1);
    if (latestScan) {
      const result = measurements(run).filter((m) => m.scanId === latestScan.scanId);
      const status = el('div', 'padding:8px 0;color:#9ff2d4', result.map((m) => `(${m.reflection}) ${m.dNm.toFixed(5)} ± ${m.toleranceNm.toFixed(5)} nm`).join(' · '));
      status.setAttribute('role', 'status'); box.append(status);
    }
    box.append(button('Review mission notebook', () => ctx.bus.emit('openMysteryNotebook', {}), 'width:100%;padding:8px;margin-top:6px'));
  };
  const offs = (['openEyepiece', 'closeEyepiece', 'scopeChanged', 'zoomChanged', 'mysteryChanged'] as const).map((event) => ctx.bus.on(event, render));
  render();
  return { dispose() { offs.forEach((off) => off()); box.remove(); } };
}
