import {
  assessClaim, BEAM_BUDGET, beamSpent, CANDIDATES, candidate, measurements,
  mysteryAdvice, SCANS, spacingNm, supports, type CandidateId, type Measurement,
} from '../shared/mystery';
import { acceptMystery, nearBragg, predictMystery, submitMystery } from '../shared/mysteryActions';
import { ownedScopes, type GameContext } from '../shared/state';
import { withKeys } from './keys';

const node = <K extends keyof HTMLElementTagNameMap>(tag: K, text = '', className = '') => {
  const el = document.createElement(tag);
  el.textContent = text;
  el.className = className;
  return el;
};
const button = (text: string, action: () => void, className = '') => {
  const b = node('button', text, className);
  b.type = 'button';
  b.onclick = action;
  return b;
};
const fmt = (value: number) => value.toFixed(5);

/** An uncertainty plot, not a fabricated microscope photograph or measured intensity curve. */
function evidencePlot(readings: Measurement[]): SVGSVGElement {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 540 210');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', 'Measured lattice-plane spacings and their bounds, compared with the three candidate reference positions.');
  const row = (reflection: '111' | '200', y: number) => {
    const low = reflection === '111' ? 0.193 : 0.166;
    const high = reflection === '111' ? 0.220 : 0.192;
    const x = (d: number) => 64 + (d - low) / (high - low) * 440;
    const ms = readings.filter((m) => m.reflection === reflection);
    const latest = ms.at(-1);
    return `<text x="12" y="${y + 5}" fill="#c4d3de">(${reflection})</text>
      <line x1="64" x2="504" y1="${y}" y2="${y}" stroke="#435365"/>
      ${[0, 1, 2, 3, 4].map((i) => {
        const d = low + (high - low) * i / 4;
        return `<text x="${x(d)}" y="${y + 27}" text-anchor="middle" fill="#96a9bb" font-size="10">${d.toFixed(3)}</text>`;
      }).join('')}
      ${CANDIDATES.map((c, i) => `<line x1="${x(spacingNm(c.id, reflection))}" x2="${x(spacingNm(c.id, reflection))}" y1="${y - 28}" y2="${y + 7}" stroke="${['#ffca80', '#97bbff', '#d0abff'][i]}" stroke-dasharray="3 3"/><text x="${x(spacingNm(c.id, reflection))}" y="${y - 34}" text-anchor="middle" font-size="10" fill="${['#ffca80', '#97bbff', '#d0abff'][i]}">${['Cu', 'Ni', 'Alloy'][i]}</text>`).join('')}
      ${latest ? `<line x1="${x(latest.dNm - latest.toleranceNm)}" x2="${x(latest.dNm + latest.toleranceNm)}" y1="${y}" y2="${y}" stroke="#b1a6ff" stroke-width="8" stroke-linecap="round"/><circle cx="${x(latest.dNm)}" cy="${y}" r="5" fill="#f4fffc"/>` : `<text x="280" y="${y - 9}" text-anchor="middle" fill="#96a9bb" font-size="11">No measurement yet</text>`}`;
  };
  svg.innerHTML = `${row('111', 57)}${row('200', 150)}<text x="284" y="203" text-anchor="middle" fill="#c4d3de" font-size="11">Plane spacing d (nm) · latest measurement per reflection</text>`;
  return svg;
}

export function mountMystery(parent: HTMLElement, ctx: GameContext) {
  let claim: CandidateId | '' = ctx.state.mystery?.conclusion?.candidate ?? '';
  let cited = new Set<string>(ctx.state.mystery?.conclusion?.evidence ?? []);
  let feedback = '';
  let withBragg = false;
  const dialog = node('dialog', '', 'mc-mystery');
  dialog.setAttribute('aria-labelledby', 'mystery-title');
  const css = node('style');
  css.textContent = `
    .mc-mystery{position:fixed;inset:0;width:100%;height:100%;max-width:none;max-height:none;margin:0;box-sizing:border-box;padding:24px 40px;border:0;border-radius:0;background:#141020ee;color:#eee;font:14px/1.45 system-ui;overflow:auto}
    .mc-mystery::backdrop{background:transparent}
    .mc-mystery *{box-sizing:border-box}
    .mc-mystery header{display:flex;align-items:flex-start;gap:16px;margin-bottom:14px}
    .mc-mystery .title-wrap{flex:1;min-width:0}
    .mc-mystery h2{margin:0 0 2px;font-size:21px;line-height:1.3}
    .mc-mystery h3{margin:0 0 6px;font-size:15px}
    .mc-mystery p{margin:4px 0 10px}
    .mc-mystery .muted{color:#aab;font-size:12px}
    .mc-mystery .intro{color:#aab}
    .mc-mystery .briefing{margin-bottom:12px}
    .mc-mystery .briefing h3{color:#ffd24a}
    .mc-mystery .body{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}
    .mc-mystery .column{display:flex;flex-direction:column;gap:12px;min-width:0}
    .mc-mystery section{padding:10px 12px;background:#1d1a26;border:1px solid #2c2838;border-radius:8px;min-width:0}
    .mc-mystery button{border:1px solid #ffffff1a;border-radius:6px;background:#ffffff0d;color:inherit;font:inherit;padding:6px 10px;cursor:pointer}
    .mc-mystery button:hover:enabled{background:#ffffff24}
    .mc-mystery button:disabled{opacity:.45;cursor:default}
    .mc-mystery :focus-visible{outline:2px solid #b1a6ff;outline-offset:3px}
    .mc-mystery button.primary{background:#8a7aff;color:#fff;font-weight:600}
    .mc-mystery button.primary:hover:enabled{background:#9b8eff}
    .mc-mystery .references{display:grid;gap:6px}
    .mc-mystery .reference{display:block;border:1px solid #2c2838;border-radius:6px;padding:8px 10px;cursor:pointer}
    .mc-mystery .reference:has(input:checked){border-color:#8a7aff;background:#8a7aff1a}
    .mc-mystery input{accent-color:#8a7aff;margin-right:8px}
    .mc-mystery .scan{border-top:1px solid #2c2838;padding-top:8px;margin-top:8px}
    .mc-mystery .scan p{margin:3px 0 0}
    .mc-mystery .budget{color:#b1a6ff;font-weight:600;margin-bottom:8px}
    .mc-mystery svg{width:100%;max-height:240px;display:block;background:#141020;border-radius:6px;margin:8px 0}
    .mc-mystery .reading{display:block;padding:8px 0;border-top:1px solid #2c2838}
    .mc-mystery .reading span{display:block;margin-left:23px}
    .mc-mystery .coach{border-left:3px solid #8a7aff;padding-left:10px;color:#ccd;margin-bottom:12px}
    .mc-mystery .feedback{padding:10px;border-radius:6px;background:#2c2838;margin-top:10px}
    .mc-mystery .success{border:1px solid #537b53;background:#213321;color:#9be59b}
    .mc-mystery select{width:100%;min-height:36px;background:#141020;color:#eee;border:1px solid #514963;border-radius:6px;padding:6px;margin:5px 0 10px;font:inherit}
    .mc-mystery footer{margin-top:14px}
    .mc-mystery details{font-size:12px;color:#aab;margin-top:10px}
    .mc-mystery summary{cursor:pointer;padding:6px 0}
    .mc-mystery a{color:#8fb8d8}
    .mc-mystery .actions{display:flex;flex-wrap:wrap;gap:8px;align-items:center}
    @media(max-width:700px){.mc-mystery{padding:18px 14px}.mc-mystery .body{grid-template-columns:1fr}.mc-mystery button{min-height:40px}}
  `;
  parent.append(css, dialog);
  const track = (id: string) => {
    dialog.close();
    if (ctx.state.currentSampleId) ctx.bus.emit('closeEyepiece', {});
    ctx.bus.emit('trackTarget', { target: { kind: 'npc', id } });
  };
  const section = (title: string) => {
    const s = node('section');
    s.append(node('h3', title));
    return s;
  };
  const render = (focusId?: string) => {
    const run = ctx.state.mystery;
    const head = node('header');
    const titleWrap = node('div', '', 'title-wrap');
    const title = node('h2', 'Mission notebook');
    title.id = 'mystery-title';
    const subtitle = node('div', '', 'intro');
    withKeys(subtitle, 'Your research missions, predictions, and recorded evidence. [Esc] closes.');
    titleWrap.append(title, subtitle);
    head.append(titleWrap, button('Close', () => dialog.close()));
    if (!run) {
      const intro = section('Meet Bragg in the Synchrotron Lab');
      intro.classList.add('briefing');
      intro.append(node('p', 'Talk to Bragg [E] and accept “The unlabelled alloy.” He will give you a prepared unknown to carry in your sample bag.'),
        node('p', 'Build a TEM, STEM, or synchrotron beamline through the main crafting tree. Load the unknown at that instrument [F], switch to diffraction, and record evidence. Return to Bragg to present your conclusion.', 'muted'),
        button('Track Bragg', () => track('bragg'), 'primary'));
      dialog.replaceChildren(head, intro);
      return;
    }
    const evidence = measurements(run);
    const solved = !!run.conclusion;
    const briefing = section(`${solved ? '✓' : '•'} The unlabelled alloy`);
    briefing.classList.add('briefing');
    briefing.append(node('p', 'Bragg has an unlabelled powder cartridge. Which of three reference materials explains its diffraction peaks?'),
      node('div', `William Lawrence Bragg · Synchrotron Lab · ${solved ? 'Complete' : 'In progress'} · ${run.scans.length}/${SCANS.length} scans recorded`, 'muted'));
    const body = node('div', '', 'body');
    const left = node('div', '', 'column');
    const right = node('div', '', 'column');
    const predict = section('1. Make a prediction');
    predict.append(node('p', 'Choose a working hypothesis before each scan. Changing your mind after new evidence is part of science.', 'muted'));
    const refs = node('div', '', 'references');
    refs.setAttribute('role', 'radiogroup');
    refs.setAttribute('aria-label', 'Working hypothesis');
    for (const c of CANDIDATES) {
      const label = node('label', '', 'reference');
      const input = node('input');
      input.type = 'radio'; input.name = 'mystery-prediction'; input.value = c.id;
      input.id = `predict-${c.id}`;
      input.checked = run.prediction === c.id; input.disabled = solved;
      input.onchange = () => { predictMystery(ctx, c.id); render(input.id); };
      label.append(input, node('strong', c.name), node('div', `${c.formula} · cubic cell ${fmt(c.latticeNm)} nm`, 'muted'),
        node('div', `Predicted d: (111) ${fmt(spacingNm(c.id, '111'))} · (200) ${fmt(spacingNm(c.id, '200'))} nm`, 'muted'));
      refs.append(label);
    }
    predict.append(refs);
    const experiment = section('2. Use your instrument in the world');
    experiment.append(node('div', `${BEAM_BUDGET - beamSpent(run)} / ${BEAM_BUDGET} beam-time credits left`, 'budget'));
    const fixed = ownedScopes(ctx.state.inventory, ctx.data).filter((r) => r.scope.site);
    experiment.append(node('p', fixed.length
      ? 'Carry the unknown to your TEM/STEM in the science lab or your synchrotron beamline in the Synchrotron Lab. Press F at the instrument, select Bragg’s unknown powder, then choose Electron diffraction or X-ray diffraction. Record scans in the eyepiece.'
      : 'Bragg’s prepared unknown is in your sample bag. Continue gathering and crafting until you build a TEM. Then take the sample to the electron microscope in the science lab and press F.', 'muted'));
    experiment.append(button(ctx.state.currentSampleId ? 'Return to eyepiece' : 'Return to the world', () => dialog.close()));
    for (const scan of SCANS) {
      const done = run.scans.find((s) => s.scanId === scan.id);
      const wrap = node('div', '', 'scan');
      wrap.append(node('strong', `${done ? '✓ ' : '○ '}${scan.name} · ${scan.cost} credits`),
        node('p', done?.instrument ? `Recorded with your ${done.instrument.name} · ${done.instrument.mode === 'ediff' ? 'electron diffraction' : 'X-ray diffraction'}.` : 'Not yet measured. Use the recording controls on your instrument.', 'muted'));
      experiment.append(wrap);
    }
    left.append(predict, experiment);
    const results = section('3. Read the evidence');
    results.append(node('p', 'Dashed lines: reference predictions. Purple bars: measured bounds. Select the readings you will cite in your conclusion.', 'muted'), evidencePlot(evidence));
    if (!evidence.length) results.append(node('p', 'Your notebook is empty. Make your first measurement.', 'muted'));
    for (const m of evidence) {
      const label = node('label', '', 'reading');
      const check = node('input');
      check.type = 'checkbox'; check.checked = cited.has(m.id); check.disabled = solved;
      check.onchange = () => { if (check.checked) cited.add(m.id); else cited.delete(m.id); };
      label.append(check, node('strong', `(${m.reflection}) ${fmt(m.dNm)} ± ${fmt(m.toleranceNm)} nm`),
        node('span', SCANS.find((s) => s.id === m.scanId)!.name, 'muted'),
        node('span', `Prediction: ${candidate(m.prediction).name}, ${fmt(spacingNm(m.prediction, m.reflection))} nm — ${supports(m, m.prediction) ? 'consistent within bounds' : 'outside measured bounds'}.`, 'muted'));
      results.append(label);
    }
    const conclude = section(solved ? '4. Investigation complete' : '4. Submit a supported conclusion');
    const coach = node('div', '', 'coach');
    coach.append(node('strong', 'Lab notebook guidance'), node('p', mysteryAdvice(run)), node('div', 'Scripted guidance from your observations · no API key needed', 'muted'));
    conclude.append(coach);
    if (!solved) {
      const label = node('label', 'The evidence supports…'); label.htmlFor = 'mystery-claim';
      const select = node('select'); select.id = 'mystery-claim';
      select.append(new Option('Choose a conclusion', ''));
      CANDIDATES.forEach((c) => select.append(new Option(c.name, c.id)));
      select.value = claim;
      select.onchange = () => { claim = select.value as CandidateId | ''; };
      const submit = button('Present conclusion to Bragg', () => {
        if (!claim) feedback = 'Choose a candidate, then cite the measurements that support it.';
        else {
          const assessment = submitMystery(ctx, claim, [...cited]);
          feedback = assessment.text;
        }
        render('mystery-feedback');
      }, 'primary');
      submit.disabled = !withBragg || !nearBragg(ctx);
      conclude.append(label, select, submit);
      if (submit.disabled) conclude.append(node('p', 'Return to Bragg in the Synchrotron Lab and open the mission in his dialogue to present your evidence.', 'muted'), button('Track Bragg', () => track('bragg')));
    }
    const status = node('div', solved ? assessClaim(run, run.conclusion!.candidate, run.conclusion!.evidence).text : feedback, `feedback${solved ? ' success' : ''}`);
    status.id = 'mystery-feedback'; status.tabIndex = -1; status.setAttribute('role', 'status');
    if (solved) status.append(node('div', `${run.scans.length} scans · ${beamSpent(run)} / ${BEAM_BUDGET} beam-time credits used`, 'muted'));
    if (solved || feedback) conclude.append(status);
    right.append(results, conclude);
    body.append(left, right);
    const foot = node('footer');
    const actions = node('div', '', 'actions');
    if (solved && withBragg && nearBragg(ctx)) actions.append(button('Ask Bragg for another sample', () => {
      if (!acceptMystery(ctx, crypto.getRandomValues(new Uint32Array(1))[0]!)) return;
      claim = ''; cited = new Set(); feedback = ''; render('predict-copper'); dialog.scrollTop = 0;
    }));
    if (solved) actions.append(button('Download lab report', () => {
      const report = { mission: 'The unlabelled alloy', model: 'Educational FCC diffraction; bounded synthetic error; three reference candidates only.', scans: run.scans, measurements: evidence, conclusion: run.conclusion, beamTimeUsed: beamSpent(run), beamTimeBudget: BEAM_BUDGET };
      const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
      const a = node('a'); a.href = url; a.download = 'microscopecraft-lab-report.json'; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    }));
    actions.append(node('span', 'Progress is included in your game save. Esc closes the notebook.', 'muted'));
    const details = node('details');
    details.append(node('summary', 'The science, sources, and limits of this mission'),
      node('p', 'For a cubic crystal, d = a / √(h² + k² + l²). The (111) and (200) reflections are allowed in a face-centred cubic lattice. A diffractometer measures scattering angles; these readouts express them as plane spacings using Bragg’s law, λ = 2d sin θ.'),
      node('p', 'This is a closed-set identification exercise using ideal, unstrained, single-phase reference materials. The 50:50 atomic Cu–Ni alloy uses linear interpolation of lattice constants (Vegard’s-law approximation). Real samples may have strain, mixtures, temperature shifts, and instrument errors. Two peaks do not establish arbitrary real-world chemical composition.'),
      node('p', 'Bragg supplies a prepared specimen suitable for the game’s electron and X-ray instruments. Measurement errors are synthetic and bounded; the bars are model bounds, not statistical confidence intervals. Beam-time credits are a game abstraction. The plot shows spacing intervals, not diffraction intensities.'));
    for (const [text, href] of [
      ['IUCr · H. Lipson: powder diffraction of metals and alloys', 'https://www.iucr.org/what-we-do/education/pamphlets/study-of-metals-and-alloys-x-ray-powder-diffraction-methods'],
      ['Copper Development Association · Cu–Ni lattice parameters and solid solutions', 'https://www.copper.org/applications/marine/cuni/properties/DKI_booklet.php'],
    ]) {
      const p = node('p'); const a = node('a', text); a.href = href!; a.target = '_blank'; a.rel = 'noopener'; p.append(a); details.append(p);
    }
    foot.append(actions, details);
    const scroll = dialog.scrollTop;
    dialog.replaceChildren(head, briefing, body, foot);
    dialog.scrollTop = scroll;
    if (focusId) dialog.querySelector<HTMLElement>(`#${focusId}`)?.focus({ preventScroll: true });
  };
  // The native modal traps focus; stop game hotkeys while leaving normal form defaults available.
  const onKey = (e: KeyboardEvent) => {
    if (!dialog.open) return;
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); dialog.close(); }
  };
  addEventListener('keydown', onKey, true);
  const off = ctx.bus.on('openMysteryNotebook', () => open(false));
  const open = (fromBragg = false) => {
    if (dialog.open || !ctx.state.mystery) return;
    withBragg = fromBragg;
    document.exitPointerLock?.();
    render(); dialog.showModal(); dialog.scrollTop = 0;
  };
  return {
    open,
    dispose() {
      off();
      removeEventListener('keydown', onKey, true);
      dialog.remove(); css.remove();
    },
  };
}
