# MicroscopeCraft

A Minecraft-style browser game: gather materials, craft parts, build instruments (hand lens → compound → high-quality optics → fluorescence → transmission electron microscope → aberration-corrected STEM → a synchrotron beamline modelled on Cornell's CHESS), and look through them to see smaller worlds. Historical scientists around campus ask to see what you find. Game design: [DESIGN.md](DESIGN.md) (source of truth).

Built for the [LLM Hackathon](https://llmhackathon.github.io/).

TypeScript + Vite. Three.js for the 3D world, a plain 2D canvas for the microscope view.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 (click the world, WASD, E gather or talk, F eyepiece, M Microdex, J journal)
npm run check    # typecheck + lint + tests; must pass before every PR
```

Sounds are synthesised in the browser (`src/ui/sound.ts`); the side panel has a mute button.

Other scripts: `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.
In dev, `window.game` exposes the game context (`game.state`, `game.bus`) and `window.__world` can teleport (`__world.lookAtKind('slides')`, `__world.lookAtKind('abbe')`).

## How it fits together

```
data/*.json        recipes, materials, samples, scientists (npcs), achievements, object catalog, fixed world spec
src/shared/        pure TS, no Three.js, no DOM: schema (Zod), state + actions, event bus, sim formulas, achievements, world-spec validator
src/shared/sim/    optics and walls, plus the physics of each mini-game (tem, corrector, ptycho, beamline, tomo, bench)
src/world/         3D world            (Person A)  mountWorld(el, ctx)
src/scope/         2D eyepiece         (Person B)  mountScope(el, ctx)   with one panel per mini-game
src/ui/            crafting, Microdex, journal, scientist dialogs (Person D)  mountUI(el, ctx)
src/guide/         guide client        (Person C)  mountGuide(ctx)
src/main.ts        loads data, creates state, mounts every module (the only file that imports them all)
```

Every module depends on `src/shared`; **no module imports another** (ESLint enforces it). Modules talk through:

- **State**: `ctx.state` is read-only for renderers. Change it only with the actions in `src/shared/state.ts` (`gather`, `craft`, `discover`, `completeQuest`, `recordScore`, `visit`, `setSite`, `setAlign`). Every action re-checks the achievements.
- **Events** (`src/shared/events.ts`): `openEyepiece({sampleId})`, `closeEyepiece`, `itemGathered`, `itemCrafted`, `discoveryUnlocked`, `tierChanged`, `zoomChanged`, `scopeChanged`, `trackItem`, `trackTarget`, `talkTo`, `questCompleted`, `achievementUnlocked`, `minigameScored`, `areaVisited`, `guideAsked`, `guideReplied`.
- **Steps and modes**: a microscope recipe lists `steps` (label, magnification, NA, imaging `mode`, optionally an add-on it `requires`, and a per-step lens blur or voltage). `setZoom(ctx, i)` picks one; `state.scope` always holds the current step.
- **Microdex**: `microdex(data, state)` (`src/shared/microdex.ts`) groups one card per feature by area. The eyepiece keeps the best picture of each discovery in `state.snapshots`. A sample is a `data/samples.json` entry; `npm test` checks every blurb is two sentences and every feature is reachable by some instrument step.
- **Sim**: `visibility(feature, scope, stain)` in `src/shared/sim/optics.ts` returns whether a feature shows and why not (`other-mode`, `unresolved`, `empty-magnification`, `too-small-to-see`, `low-contrast`). `explainWall()` in `src/shared/sim/walls.ts` turns that into the plain-language "hit a wall" message. The scope banner and the guide both use it.
- **Achievements and requests**: one rule language (`Condition` in `schema.ts`, checked by `src/shared/achievements.ts`) drives both the achievements and what each scientist asks for. Every request is an achievement too.

Units: lengths are micrometres (µm) everywhere, spelled in field names (`sizeUm`, `dLensUm`).
Simplified physics is labelled in comments next to the formula.

## Controls

| Key | Action |
| --- | --- |
| Click, WASD, mouse | Look and walk (Esc frees the mouse) |
| Shift, Space | Run, jump |
| V | Switch between the over-the-shoulder view (the default) and first-person |
| E | Gather the item you are aiming at, or talk to the scientist you are aiming at |
| F | Look at the aimed sample through your newest portable instrument (F or Esc to leave). At a cabinet or table, pick a sample first (1–9). Once you own a fixed instrument this also takes a bit of the sample along; F at the electron microscope in the science lab, or at the beamline desk in Wilson Lab, puts one in |
| C | Craft the next ready step of your goal (no mouse needed) |
| 1, 2, 3… | In the eyepiece: switch to another instrument you own, to compare (or click its button) |
| Wheel or slider | Focus (light microscopes) |
| T | Tech tree: every part, with add-ons shown by dashed links |
| J | Journal: achievements with progress, and every scientist's requests with Track buttons |
| M | Microdex (click a card you have not found to track its sample) |
| I | Show or hide the inventory box |
| Tab | Menu: tech tree, Microdex, journal, sound, save and restart, guide (G jumps straight to the guide box) |
| K | Restock every raw material, skipping the identifications (only when the URL ends in `?demo`) |

## Finding your way

The goal card at the top right is always on screen. Its bold line is the one thing to do right now ("Gather 2 Beach sand", "Press C to craft Glass", "Look (F) at a Grey rock with your Hand lens"). Press ▸ to see the whole tree for the next instrument with ✓ for what is done. The nearest source of the material you need is shown by a yellow **arrow and distance** at the top of the screen, and a small floating marker over it once you are within about 30 m. A second, blue arrow points at whatever you tracked from the journal, a scientist's dialog or the Microdex.

**Some materials must be identified first.** Each is only recognisable through the *previous* instrument: until you have spotted what is inside, the rock is plain, the seed is just a seed, and E is locked.

| To build | You need | Identify it with | Look (F) at |
| --- | --- | --- | --- |
| Compound microscope | Copper (the lamp) | Hand lens: copper veins | A plain grey rock on the west slope |
| High-quality microscope | Plant oil (immersion oil) | Compound microscope: oil droplets | A sunflower seed |
| Fluorescence microscope | Fluorite (low-dispersion objective, filters), tungsten (arc lamp) | High-quality microscope at 400×: fluorite crystals; tungsten grains | A purple-veined rock on the gorge rim; a heavy grey rock |
| Transmission electron microscope | Willemite (the green viewing screen) | Fluorescence microscope in fluorescence: its green glow | A pale green rock by the creek |
| Aberration-corrected STEM | Monazite (cerium for the scintillator) | TEM, electron diffraction: its 0.286 nm reflection | Dark heavy sand by the creek |
| CHESS beamline | Beryl (beryllium windows and X-ray lenses) | STEM, ptychography: beryllium atoms, too light for annular dark field | Pale six-sided crystals at the foot of the west slope |

Ask the guide with **G**: "where do I find quartz sand?", "how do I make glass?" or "what next?".

## The world

A university campus about 300 m across (north is up the quad, -z), laid out after Cornell's. Everything is procedural: terrain, buildings, models and textures are generated in code, with no asset files.

| Where | What is there |
| --- | --- |
| Quad (centre) | Lawn, halls, bronze statues of Leeuwenhoek and Ruska, a spare bronze chime bell beside the clock tower. Leafy plants, flowers with a honeybee, a butterfly wing, sunflowers, a picnic table (salt, notebook paper). Santiago Ramón y Cajal stands on the steps of the south library |
| Lake (north-east, where you start) | Lake water, mud and an algae mat at the edge, a duck feather, sand. Antonie van Leeuwenhoek waits on the shore |
| Gorge (north) | Iron, galena, quartz and fluorite on the rim; down by the creek, pale willemite rocks, dark monazite sand and a slab of fossil shale |
| West slope and pine grove | Copper and iron rocks, heavy tungsten rocks and beryl crystals at the foot, mica schist; among the pines, resin stumps, a pine branch, a fallen oak log, mushrooms, moss, lichen, a spider web, ferns and an old bone. Robert Hooke stands by the log |
| Greenhouse (south of the quad) | Onion, potato, orchid, stinging nettle and cotton. Robert Brown works here |
| Science building (south-east) | The glass-walled lab: stains on the shelf by the door, a slide cabinet and a materials cabinet, the electron microscope bay (each part you craft appears in place). Ernst Abbe stands outside; Zernike, Gram, Ruska, June Almeida and Albert Crewe inside |
| Wilson Lab (east) | The CHESS hall beside the CESR ring: the beamline from the ring wall to the hutch, a sample rack, and Röntgen (at the door), Batterman, Bragg, Franklin and Hodgkin |
| Engineering quad (south, down the path past the greenhouse) | Halls after Bard, Snee, Upson and Phillips. The geology hall's rock garden: granite, basalt, obsidian, marble, chalk, pyrite, malachite, lodestone and garnet schist. A materials yard: concrete blocks, a rusty steel beam, bricks, a solar panel and a catalytic converter. A glass atrium (after Duffield) with display cases of quantum dots, carbon nanotubes, a zeolite, a metal-organic framework, a superconductor pellet and a blue LED |

**Fixed instruments stay where they are built**: the electron microscopes in the science lab, the beamline in Wilson Lab. Look (F) at a sample anywhere and you take a bit along (up to 8); the HUD shows where to carry them. Light microscopes work anywhere.

## What to build (from `data/recipes.json`)

| Instrument | Raw materials in total | Components |
| --- | --- | --- |
| Hand lens (tier 1) | 2 beach sand, 1 iron | Glass lens, iron frame |
| Compound microscope (tier 2) | 6 beach sand, 2 iron, 1 copper | 2 glass lenses, iron tube, focus knob, lamp |
| High-quality microscope (tier 3) | 6 quartz sand, 1 copper, 1 plant oil, plus the compound microscope | 2 precision lenses, condenser, immersion oil |
| Fluorescence microscope (tier 4) | 6 quartz sand, 2 fluorite, 1 tungsten, plus the high-quality microscope | Fluorite objective, arc lamp, filter cube. Add-ons: phase contrast kit, dark-field condenser |
| Transmission electron microscope (tier 5) | 3 tungsten, 10 iron, 9 copper, 3 resin, 1 willemite, 2 beach sand | Electron gun (filament, Wehnelt cap, high-voltage tank); condenser lens system; objective lens and stage; projector lens system; vacuum system; viewing screen |
| Aberration-corrected STEM (tier 6) | 1 tungsten, 5 iron, 11 copper, 1 resin, 1 monazite, 4 quartz sand, 2 beach sand, plus the TEM | Field-emission gun, aberration corrector (4 multipoles), scan coils, annular dark-field detector, pixel array detector (EMPAD) |
| CHESS beamline (tier 7) | 12 iron, 9 copper, 2 monazite, 2 resin, 2 beryl, 10 quartz sand, 3 galena | Double-bend achromat cell, CHESS Compact Undulator, front end, double-crystal monochromator, compound refractive lens, shielded hutch, fluorescence detector, X-ray pixel array detector, rotation stage |

## Imaging modes, stains and mini-games

Each instrument step has an imaging mode that decides what shows: bright field, **phase contrast** (clear cells), **dark field** (detects things smaller than it resolves, such as flagella), **fluorescence** (only what glows), **TEM**, **electron diffraction**, **annular dark field** (heavy atoms shine), **ptychography** (sees light atoms too), **X-ray tomography** (inside things), **X-ray fluorescence maps** (where an element is) and **X-ray diffraction**. Light-microscope samples can be stained with iodine, methylene blue or the Gram stain (bottles on the lab's reagent shelf).

Seven mini-games, each scored 0-100%, change what the eyepiece shows:

| Mini-game | Where | What you do | Physics |
| --- | --- | --- | --- |
| Köhler illumination | High-quality and fluorescence microscopes, transmitted light | Focus, centre and size the field diaphragm, set the aperture diaphragm | Resolution is λ / (NA objective + NA illumination); an unaligned condenser loses the finest detail (Amphipleura's 0.25 µm striae) |
| Progressive stain | Light microscopes, with hematoxylin (felled logwood on the quad lawn) or methylene blue | Add a drop, watch the nuclei darken before the cytoplasm, rinse at the peak; the contrast meter only shows after the rinse | First-order uptake, nuclei 4× faster than cytoplasm: contrast e^(−t/τb) − e^(−t/τt) peaks at t* = ln(τb/τt)·τtτb/(τb − τt); how close you rinse scales the stain's contrast |
| Gram stain | Light microscopes, with the kit | Crystal violet, iodine, a few seconds of alcohol, safranin, on a 10× stopwatch | Dye kinetics: thin walls lose the violet in seconds, thick iodine-locked walls keep it |
| TEM alignment | TEM | Beam shift, eucentric height with the α wobbler, stigmators against the live FFT, Scherzer focus | Contrast transfer function χ(k), Thon rings; leftover defocus and astigmatism blur the atoms |
| Aberration corrector | STEM, annular dark field | Tune C1, A1, B2, A2, C3 until the Ronchigram's centre is flat, then choose the aperture | Krivanek's χ(θ, φ) to fifth order; probe = diffraction limit ⊕ ray blur |
| Electron ptychography | STEM, ptychography | Choose probe size and scan step, then reconstruct | Real ePIE on simulated diffraction patterns: about 60% overlap or more converges |
| Beam tuning | Beamline, X-ray fluorescence | Slide the undulator's magnet rows, turn the Si(111) monochromator | CCU harmonics on 6 GeV CESR, Bragg's law, absorption edges |
| Tomography | Beamline, tomography | Find the rotation axis | Sinogram and filtered back-projection; a wrong axis smears edges into arcs |

## Scientists and achievements

Fifteen scientists who made discoveries with microscopes or X-rays stand around campus: Leeuwenhoek, Hooke, Robert Brown, Abbe, Zernike, Cajal, Gram, Ruska, June Almeida, Albert Crewe, Röntgen, W. L. Bragg, Rosalind Franklin, Dorothy Hodgkin and Boris Batterman (CHESS's first director). Press E to talk: each has two to five requests (53 in all), mostly "show me what you found", and every request done is an achievement. A gold **!** over a scientist means you can show them something now; **?** means they are still waiting. With 58 more achievements for discoveries, instruments, areas, mini-games and milestones, there are 111.

The Microdex holds 170 discoveries in 45 samples across seven areas.

## Demo script (about 10 minutes)

Open `http://localhost:5173/?demo`. The LLM prompt-to-world step of the full pitch is not built yet; see DESIGN.md.

1. **Blurry world (0:00).** Turn left to the leafy plants a few steps west of where you start, aim at one and press F with no instrument. The fine veins are gone. In the mud at the lake's edge your bare eyes can just make out a Paramecium. Say: "Everything we can see is limited by the eye." Talk to Leeuwenhoek (E) on the shore: he asks to see it.
2. **Build a hand lens (0:45).** Follow the goal card: gather 2 sand mounds and 1 iron rock with E, then press C four times. Look at the leaf again: the vein network is sharp and the Microdex toast appears.
3. **Discover to unlock (1:45).** The goal card says to identify copper. Look at a plain grey rock on the west slope with the hand lens: green copper veins, the rocks turn into copper ore. Press K to restock, press C through the compound microscope, then look at lake water at 800× (the banner: empty magnification).
4. **Light to its limit (3:00).** Spot oil in a sunflower seed, build the high-quality microscope and resolve bacteria at 1000× with oil. In the lab, open the diatom test slide and align the condenser (Köhler) until Amphipleura's 0.25 µm striae resolve. Show Abbe.
5. **Electrons and X-rays (3:45).** With K and C, build up to the TEM, STEM and beamline (fluorite, willemite, monazite and beryl must each be identified on the way). Align the TEM until gold's 0.235 nm lattice planes resolve, flatten the Ronchigram until single silicon atoms in graphene shine, reconstruct MoS₂ by ptychography (the 0.39 Å record), and in Wilson Lab tune the undulator to map cobalt in vitamin B12 for Dorothy Hodgkin. Press J to show the journal.

Pitch points: the instrument is earned by building it, part by part; every upgrade has a numeric reason (shown in the HUD: resolution, NA, dose, flux); the mini-games are the real alignment procedures; all content is JSON in `data/`.

## Contributing

**Who owns what**

| Folder | Owner |
| --- | --- |
| `src/world` | Person A: 3D world and player |
| `src/scope`, `src/shared/sim` | Person B: microscope view and simulation |
| `server`, `src/guide`, `src/shared/worldspec.ts` | Person C: AI and backend |
| `src/ui`, `data/*.json` content | Person D: content and UI |
| `src/shared` (rest), `src/main.ts` | Everyone; see below |

**Branches**: `<area>/<short-description>`, with area one of `world`, `scope`, `ai`, `ui`, `shared`, `docs`. Example: `scope/blur-by-deff`. Branch from `main`.

**Small PRs**: one thing per PR, aim for under 300 changed lines, merge within a day. Run `npm run check` first. Commit messages say what and why in one line.

**Don't change `src/shared` types (`schema.ts`, `events.ts`, the `GameContext`/state API) without telling the team.** Post in the team chat first, then open a PR that changes only the contract (plus the fixes other modules need to keep compiling). Adding an optional field or a new JSON entry is fine without a heads-up; renaming, removing or tightening anything is not.

**Data-driven**: new recipe, material, sample, scientist, request or achievement = one JSON entry in `data/`. `npm test` validates it against the schema and checks cross-references (an unknown discovery, item, mini-game or area in a condition fails).

**The LLM never generates pixels or free-form content.** It outputs a world-spec JSON that `validateWorldSpec` accepts or rejects.

## The Invisible Specimen minigame

Run `npm run dev`, then open `/minigames/invisible-specimen/index.html` on the local server. The standalone game includes ten assignments, optical and electron imaging, magnification, specimen-locked zoom, and a saved discovery journal. You can also open its HTML file directly without a server.

See [integration notes](public/minigames/invisible-specimen/INTEGRATION.txt) for the completion event and iframe setup. Building entry points and inventory rewards are not wired into the main world yet.

### New visitors and footsteps

Hans Bethe stands outside the science building at (20, 20); Earl Kirkland is nearby at (20, 32). Press **E** to talk, or track them from the scientists journal. Each has two requests. Their dialogue and block-style appearances are fictionalized.

Walking and running play quiet, synthesized footsteps, with grass, stone, and water variations. Steps stop in the air, when movement stops, and when controls are unlocked. Use **Tab → Sound** to mute them along with the other game sounds.
