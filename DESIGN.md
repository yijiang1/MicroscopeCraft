# MicroscopeCraft – Game Design Document

October 21, 2026 · Yi Jiang · Updated October 21, 2026 to match the build (see "Build status")

## Vision
MicroscopeCraft is an open-world exploration game where you build every instrument yourself, from a hand lens to an aberration-corrected electron microscope and a synchrotron beamline, and use each one to see a smaller or hidden world. The world is a walkable 3D campus with realistic objects, and you play it the way you play a sandbox game: roam freely, gather what you find, craft, and build.

*Build the instrument. See the invisible.*

Eight design pillars guide every decision:

- **Build to see.** Every new view of the world is earned by building a better instrument, part by part.
- **Real physics, simple rules.** Material and optics choices change what you can see, and the rules are directionally correct; the numbers come from real instruments.
- **Wonder before jargon.** The first zoom happens within minutes, and terms appear only when a player needs them.
- **Every upgrade has a reason.** Each instrument hits a visible limit that the next one solves.
- **Discovery gates progress.** A better instrument needs a material that only the previous one could recognise, so the instrument you built is what lets you build the next one.
- **Instruments are aligned, not just owned.** The mini-games are the real procedures (Köhler illumination, TEM alignment, aberration correction, ptychography, beam tuning, tomography), and doing them well is what reveals the finest detail.
- **Scientists ask questions.** The people who made these discoveries stand around campus and ask to see what you found; showing them is an achievement.
- **Worlds from a prompt.** An LLM turns a sentence such as "a drop of pond water" into a playable, scale-layered world. (Designed and validated, not built yet; see "Build status".)

The game is built for the [4th Annual Open Scientific Intelligence Hackathon](https://luma.com/ku88xh92), a hybrid event focused on LLMs, agents and multimodal models for materials science, chemistry, physics and math.

## Audience and goals
The primary audience is students from about age 12 to first-year undergraduate who already play sandbox games and have no microscopy background. Secondary audiences are teachers, who can generate a world from a prompt, and outreach staff at microscopy and synchrotron facilities.

Players should feel surprise at each new scale and pride that they built the tool that revealed it. Over a full playthrough (about 10 to 12 hours to finish everything) they should learn six ideas, in this order:

1. **Magnification and focal length.** Lenses bend light, and their shape sets how much.
2. **Resolution.** More magnification adds no detail past a limit set by wavelength, numerical aperture and how the sample is lit.
3. **Contrast.** A feature can be large enough to resolve and still be invisible without contrast: phase contrast, dark field, fluorescence and stains make it show.
4. **Electrons, aberrations and damage.** Electrons see smaller than light does; lens aberrations, not the wavelength, then set the limit, and correctors and ptychography push past it. The beam can destroy the sample.
5. **Diffraction.** A crystal's pattern records its atomic spacings by Bragg's law, which is also how a monochromator picks one X-ray energy.
6. **X-rays.** Synchrotron X-rays see inside thick things (tomography), find where each element is (fluorescence) and solve structures (diffraction).

Success is checked in playtests: a new player builds a second-tier microscope without help, can say in their own words why their first microscope could not see bacteria, and can say why the TEM needs alignment before it shows atoms.

## Core gameplay loop
Every session repeats one loop, at smaller and smaller scales:

1. **Explore and gather.** Walk the campus and collect sand, ores, oil, resin, minerals and lab reagents. The goal panel names the next instrument and what it still needs; an arrow with the distance points to the nearest source.
2. **Identify.** Some materials look like plain rock or seeds until you look at them through the instrument you already have. Spotting what is inside unlocks gathering them (see "Discovery gates").
3. **Craft and assemble.** Smelt sand into glass, grind lenses, wind coils, build each component of an instrument separately, then assemble it. The goal card lists the steps and C crafts the next ready one. Fixed instruments show each component in place as you build it.
4. **Look and align.** Aim at a sample and press F; at a cabinet, pick a slide. Choose an imaging mode, stain the sample, and align the instrument with its mini-game; the view shows only what it can resolve.
5. **Hit a wall.** The view is blurry, empty, too dark or shows nothing in this mode, and the game explains the limit in plain words, using the simulation's own numbers.
6. **Show a scientist.** Take what you found to the scientist who asked for it; every request done is an achievement.
7. **Upgrade.** Gather better materials, build better parts and return to step 3.

One pass takes a few minutes, and the climb through instrument tiers is the long arc. The Microdex (170 discoveries), the scientists' 53 requests and 113 achievements give collection goals. Failure is gentle: gathered materials grow back, a damaged sample resets when the eyepiece closes, a bad stain washes off, and the game has no death.

## Microscope tech tree
The tree follows the real history of microscopy in eight tiers. Each tier ends at a wall the player can observe, and the next tier is the fix.

| Tier | What you build | Physics learned | Wall that motivates the next tier |
| --- | --- | --- | --- |
| 0. Naked eye | Nothing | The eye resolves about 0.1 mm | Fine veins and grains blur together |
| 1. Hand lens | One glass lens in a frame | Magnification, focal length | Cells and other tiny things are still too small |
| 2. Compound microscope | Two lenses, a tube, a lamp and a focus knob | Objective versus eyepiece, focus | Pushing magnification higher only makes a bigger blur |
| 3. High-quality optics | Quartz lenses, a condenser, immersion oil | Numerical aperture, Köhler illumination, the diffraction limit | Clear cells and fine labelled structures have too little contrast |
| 4. Fluorescence microscope | Fluorite objective, arc lamp, filter cube; add-ons for phase contrast and dark field | Contrast methods, detection below the resolution limit | Light itself is still the limit |
| 5. Transmission electron microscope | Electron gun, condenser lenses, objective and stage, projector lenses, vacuum system, viewing screen | Electron wavelength, alignment, Scherzer focus, electron diffraction, beam damage | Lens aberrations cap the detail near 0.2 nm |
| 6. Aberration-corrected STEM | Field-emission gun, aberration corrector, scan coils, annular dark-field detector, pixel detector (EMPAD) | Correcting aberrations, Z-contrast, ptychography | Electrons need thin samples in vacuum; they cannot see inside a seed or map elements in a rock |
| 7. CHESS beamline | A double-bend achromat cell on CESR, a CHESS Compact Undulator, front end, monochromator, X-ray lens, hutch and detectors | Undulator harmonics, Bragg's law, absorption edges, tomography | End of the tree |

Higher-tier instruments do not replace lower ones: a new instrument becomes the one you look through, but every instrument stays in the inventory, and in the eyepiece the keys 1, 2, 3... switch between the ones usable here. The goal card always follows the best instrument owned.

### Discovery gates

To build an instrument above the first, the player needs a material that is only recognisable through the instrument below it. Until the player has seen it, the material cannot be gathered. The rule is data: a material lists `unlockedBy`, the id of a discovery. A test fails if any tier above the first lacks such a gate, or if the gate is not visible with the previous tier.

| To build | Material that is gated | Discovered with | What the player sees |
| --- | --- | --- | --- |
| Compound microscope | Copper ore (lamp) | Hand lens | Green copper veins in a plain grey rock (50 µm) |
| High-quality microscope | Plant oil (immersion oil) | Compound microscope | Oil bodies in a sunflower seed (1.5 µm) |
| Fluorescence microscope | Fluorite (objective, filters); tungsten (arc lamp) | High-quality microscope | Purple fluorite cubes (0.6 µm); tungsten grains (0.8 µm) |
| Transmission electron microscope | Willemite (the green phosphor screen, Zn₂SiO₄:Mn, the old P1 phosphor) | Fluorescence microscope | A rock that glows green under UV |
| Aberration-corrected STEM | Monazite (cerium for the scintillator) | TEM, electron diffraction | Monazite's strongest reflection, 0.286 nm |
| CHESS beamline | Beryl (beryllium windows and refractive lenses) | STEM, ptychography | Beryllium atoms, too light for annular dark field |

The sizes are chosen so each gate really is out of reach of the tier before it. The goal card shows an "Identify" row ahead of the gather rows, with what to look at, which instrument and which step, and for fixed instruments where to take the sample.

## Materials and crafting
Material choice is the main decision in the game: the properties of what you gather set the quality of what you build.

| Resource | Crafted into | Why |
| --- | --- | --- |
| Beach sand | Glass, lenses | Impure glass blurs (a 30 µm lens blur in a hand lens, 1 µm in the compound microscope) |
| Quartz sand | Quartz glass, precision lenses, silicon | Pure: 0.05 µm lens blur; reduced to silicon for crystals and detectors |
| Iron ore | Frames, tubes, magnet yokes, vacuum chambers | Strength, and soft iron guides magnetic fields |
| Copper ore (identify) | Lamps, coils, magnets, detectors | Conductivity |
| Plant oil (identify) | Immersion oil | Refractive index close to glass raises the NA to 1.3 |
| Tungsten ore (identify) | Filament, arc-lamp electrodes, apertures, field-emission tip | Melts above 3,400 °C |
| Resin | Vacuum seals, high-voltage insulation | Leak-tight |
| Fluorite (identify) | Fluorite objective, filter cube | Low dispersion; fluorescence |
| Willemite (identify) | Viewing screen | Glows green where electrons land |
| Monazite (identify) | Scintillator, NdFeB magnets | Cerium and neodymium |
| Beryl (identify) | Beryllium window, compound refractive lens | Beryllium barely absorbs X-rays |
| Galena | Lead for the hutch | Stops X-rays |
| Stains (lab shelf; logwood on the quad lawn) | Iodine, methylene blue, the Gram stain kit; hematoxylin | Contrast for starch, DNA and bacterial walls |

There are 70 recipes. Complex instruments are built from components, each with its own recipe (the TEM from six, the STEM from five, the beamline from nine), and the fixed instruments show each component in place as it is built. Add-ons (phase contrast kit, dark-field condenser) unlock extra steps on the fluorescence microscope. Materials grow back 15 seconds after they are gathered, and the world holds enough of each to build any one instrument without waiting.

## World and scale content
The world is an open 3D campus, about 300 m across and laid out after Cornell's, built entirely from procedural models and textures: a quad lined with halls, a clock tower, a west slope with a pine grove, a gorge with a waterfall and a creek, a lake, a glass greenhouse, the science building with its lab, an engineering quad to the south (a rock garden, a materials yard and a glass atrium of nanomaterials and devices), and Wilson Laboratory with the CHESS hall beside the CESR storage ring (768 m around, 6 GeV positrons at 200 mA after the CHESS-U upgrade; the hall's shield wall curves with the ring's radius). Cabinets in the lab and a rack at the beamline hold prepared slides and materials samples; F, then a number, picks one.

| Area | What the player finds | Discoveries |
| --- | --- | --- |
| Quad | Leaves, flowers, a honeybee, a butterfly wing, sunflowers, a picnic table (salt, paper), a bronze chime bell | 29 |
| Lake | Lake water, an algae mat, mud, a duck feather | 16 |
| Pine grove | Pine needles and pollen, oak bark, mushrooms, moss, lichen, a spider web, ferns, an old bone | 25 |
| Greenhouse | Onion, potato, orchid, stinging nettle, cotton | 12 |
| Gorge and slope rocks | Quartz, copper, tungsten, fluorite, willemite, monazite sand, beryl, fossil shale, mica, iron, galena | 29 |
| Science lab | The crystal, seven prepared slides, eight materials samples | 44 |
| Wilson Lab | Lysozyme, vitamin B12, a DNA fibre, steel, a battery cathode, an insect in amber, an iron meteorite, a silicon crystal | 19 |
| Engineering quad | Rock garden (granite, basalt, obsidian, marble, chalk, pyrite, malachite, lodestone, garnet schist); materials yard (concrete, rusty steel, brick, a solar panel, a catalytic converter); atrium cases (quantum dots, carbon nanotubes, zeolite, a MOF, a superconductor, a blue LED) | 64 |

Every sample has hidden layers that appear only when an instrument (and the right mode, stain or alignment) can reveal them. Sizes below are approximate.

| Tier | Typical feature size | What the player can discover |
| --- | --- | --- |
| 0 | About 0.2 mm and up | Salt cubes, Volvox, Paramecium, rotifers, tardigrades, mushroom gills |
| 1 | About 30 µm and up | Leaf and wing veins, copper veins, pine stomata, fern spores |
| 2 | About 1 to 30 µm | Cells, pollen, chloroplasts, red blood cells, Gram-stained bacteria, chromosomes |
| 3 | About 0.2 to 1 µm | Bacteria, diatom pore rows, Amphipleura's 0.25 µm striae, dendritic spines, mitochondria |
| 4 | Contrast, not size | Clear cells and cilia in phase contrast, flagella in dark field, glowing minerals and bud scars in fluorescence |
| 5 | About 0.2 to 100 nm | Viruses and their spikes, ribosomes, membranes, nanotubes, gold lattice planes, diffraction patterns |
| 6 | About 0.04 to 0.2 nm | Graphene, silicon dumbbells, single uranium atoms, Z-contrast columns, light atoms by ptychography, the 0.39 Å record |
| 7 | Inside, elements, structure | Tomography of seeds, fossils and batteries; element maps; protein, DNA and metal diffraction |

The Microdex is a collection log with one card per discovery: a picture of what the player actually saw (their sharpest view), its size, and a two-sentence explanation, grouped by area. It holds 170 discoveries in 45 samples; seven of them unlock materials.

## Simulation model
A few formulas decide what the player sees. They are simplified but directionally correct, so a better material, a smaller wavelength or a better alignment always helps for the right reason. All lengths are in micrometres in the code.

Total magnification is the product of the two lens stages: $M = M_{obj} \cdot M_{eye}$.

The smallest detail a microscope resolves (Abbe) depends on wavelength and the numerical apertures of the objective and of the illumination:

$$d_{diff} = \frac{\lambda}{NA_{obj} + NA_{ill}}$$

With a well-aligned condenser (or incoherent light, as in fluorescence) $NA_{ill} = NA_{obj}$ and this is the familiar $\lambda / 2NA$. The Köhler mini-game sets $NA_{ill}$ for the high-quality and fluorescence microscopes; unaligned, the condenser lights about half the objective's aperture.

Electron wavelengths are relativistic (2.51 pm at 200 kV, 4.18 pm at 80 kV), X-ray wavelengths come from the photon energy (0.103 nm at 12 keV):

$$\lambda_{e}\,[\mathrm{nm}] = \frac{1.22639}{\sqrt{V\,(1 + 0.97848 \times 10^{-6}\,V)}} \qquad \lambda_{X}\,[\mathrm{nm}] = \frac{1.23984}{E\,[\mathrm{keV}]}$$

Lens defects (and the player's leftover misalignment) add blur in quadrature: $d_{eff} = \sqrt{d_{diff}^{2} + d_{lens}^{2}}$. Focus adds to the lens blur on light microscopes; on the TEM the alignment panel does (leftover defocus from Scherzer focus and astigmatism); on the STEM the corrector sets the probe; on the beamline the rotation-axis error smears tomograms.

**Imaging modes.** Each step has a mode, and each feature has a contrast in bright field plus optional contrasts per mode or stain (`contrastIn`). Fluorescence, the diffraction modes and X-ray fluorescence are exclusive: they show only features listed for them. Ptychography also shows what the other electron images show. In diffraction modes the smallest spacing recorded is Bragg's $d = \lambda / 2\sin\theta_{max}$, with no lens term and no eye limit. In dark field and fluorescence a listed feature smaller than $d_{eff}$ is still *detected*, as a spot the size of $d_{eff}$.

A feature appears only if the rules pass, checked in the order the player hits the walls:

1. **Right mode.** It has contrast in this mode (or stain); otherwise "shows up another way", with a hint at which.
2. **Resolved** (or detected). Otherwise "unresolved", or "empty magnification" past about 1000 × NA (light only).
3. **Visible to the eye.** Size × M reaches about 0.1 mm (not in diffraction).
4. **Contrast.** Effective contrast above 0.1.

At tiers 5 and 6 the player also manages dose, $D = I t / A$; a fragile sample's signal fades as $e^{-D/D_c}$, so a virus dies in seconds at 150,000× and survives minutes at 50,000×.

**Mini-game physics** (all in `src/shared/sim`, all tested):

- *TEM alignment* (`tem.ts`): the wave aberration $\chi(k) = \pi\lambda(\Delta f\,k^2 + A\ \text{terms}) + \tfrac{\pi}{2} C_s \lambda^3 k^4$ with $C_s$ = 1.2 mm; Thon rings $\sin^2\chi$ in the live diffractogram; Scherzer defocus $-1.2\sqrt{C_s\lambda} \approx -66$ nm. A sample off the eucentric height is defocused by 1000 nm per µm.
- *Aberration corrector* (`corrector.ts`): Krivanek's $\chi(\theta,\phi)$ with C1, A1, B2, A2, C3 tunable and a fixed C5 = 4 mm; the Ronchigram is computed as $|FFT(\text{probe} \times \text{amorphous carbon})|^2$; probe size is the diffraction limit $\lambda / 2\theta$ combined with the geometric ray blur $(\lambda/2\pi)|\nabla\chi|$ at the aperture edge.
- *Ptychography* (`ptycho.ts`): real ePIE (object and probe updated) on simulated diffraction patterns, starting from a probe guess without its defocus; about 60-70% overlap converges, 50% or less does not.
- *Beam tuning* (`beamline.ts`): CHESS Compact Undulator (28.4 mm period, 0.952 T, tuned by shifting one magnet row: $B = B_0|\cos(\pi\phi/\lambda_u)|$, $K = 0.934\,B\,\lambda_u[\mathrm{cm}]$, $E_n = n \cdot 0.9496\,E^2 / (\lambda_u (1 + K^2/2))$ on 6 GeV CESR, odd harmonics with Bessel-function strengths), a Si(111) monochromator (d = 0.31356 nm) and absorption edges (Cu K 8.98 keV, Pb L₃ 13.04 keV...).
- *Tomography* (`tomo.ts`): sinogram and Ram-Lak filtered back-projection; the axis error smears the slice.
- *Köhler and Gram* (`bench.ts`): Köhler's four parts score the setup and set $NA_{ill}$; the Gram stain is simple dye kinetics (crystal violet soaks in over about 20 s, alcohol strips thin walls at 0.5/s and iodine-locked thick walls at 0.02/s). The progressive stain (hematoxylin, methylene blue) is first-order uptake with nuclei 4× faster than cytoplasm; the contrast peaks at $t^* = \ln(\tau_b/\tau_t)\,\tau_t\tau_b/(\tau_b-\tau_t)$, and the share of the peak reached scales the stain's contrast.

Every simplification is labelled in a code comment next to its formula. The wall explanations (`explainWall`) are built from these numbers, and both the eyepiece banner and the guide use them.

## AI features

The LLM never draws the world. It writes a structured description, and the game's own generators turn that into content. This keeps worlds consistent, fast and physically sensible. Status: the contract (JSON schema, validator, fixed catalog, fallback world) is built and tested; the model calls and the server are deferred.

**Prompt-to-world generator.** A teacher or player types a sentence such as "a drop of pond water" or "a perovskite solar cell". A planner model returns a JSON spec of objects at each scale. A validator checks it against a fixed catalog of object types, tiers and size ranges, and sends one error message back to the model for a retry if it fails. The generators then build the content, and the world is cached so no model call happens during play. Built: the spec schema, the validator with retry-ready error messages, the object catalog and the default world spec. Not built: the planner call, the retry loop, the cache and the generators.

*Figure: prompt-to-world pipeline.* Prompt → Planner (LLM) → Valid? If yes → Generators → Playable world. If no, the error is sent back to the planner for one retry, then the game falls back to a default world. (This figure is a drawing in the online doc.)

A valid spec is cached, so the game never waits on the model during play.

Example spec (the shipped default world):

```json
{
  "name": "Pond water drop",
  "scales": [
    {"tier": 2, "features": [{"type": "alga", "species_hint": "Spirogyra", "density": 12}]},
    {"tier": 3, "features": [{"type": "bacteria", "shape": "rod", "density": 200}]}
  ],
  "learning_notes": {"3": "Bacteria become visible once you can resolve about 1 micrometer."}
}
```

**Grounding in real data.** For materials prompts, the model names the material and the game looks up its real structure in a database such as the Materials Project, so lattice type and spacing are facts, not guesses. Organism sizes come from a small hand-checked table. If time allows, atomic-resolution images are simulated with abTEM from the real structure. (Not built.)

**Guide.** A guide that sees the player's current build and view and answers questions such as "why is my image blurry?" in plain words. Its answers are grounded in the simulation's own numbers ($d_{eff}$, contrast, dose). Built today: an offline guide that picks the nearest wall for the sample being looked at and explains it with `explainWall`; the same text appears as a banner in the eyepiece. Not built: the LLM-written version, which would take the same numbers as input and fall back to the offline guide on failure.

**Agent benchmark (stretch).** An LLM agent plays the same crafting loop through an API, which gives a measurable test of how well agents plan and characterize unknown materials. (Not built.)

## MVP scope for the hackathon
The MVP was one complete play loop that can be demoed in about five minutes: gather, craft, see something new, upgrade. The build has since grown into a full game.

| Area | Must ship | Stretch | Status |
| --- | --- | --- | --- |
| World | One small open 3D map | More biomes | A campus with a quad, lake, gorge, pine grove, greenhouse, science lab, Wilson Lab and an engineering quad |
| Crafting | About eight recipes | Full materials property system | 70 recipes, components for every complex instrument, add-ons |
| Microscopes | Tiers 1 to 3 end to end | Tiers 4 and 6 | Tiers 0 to 7 built, including a CHESS beamline |
| Samples | About ten discoveries | Samples from a prompt | 170 discoveries in 45 samples |
| Mini-games | None | | Eight: Köhler, Gram stain, progressive stain, TEM alignment, aberration corrector, ptychography, beam tuning, tomography |
| People and goals | None | | 15 scientists with 53 requests, 113 achievements, a journal |
| AI | Guide grounded in the simulation's numbers | Prompt-to-world, Materials Project, abTEM | Offline guide only; LLM features deferred |
| Polish | Simple art, readable UI, one sound per action | Music, tutorial | Procedural 3D art, synthesised sounds; no music or tutorial |

## Technical architecture

The game runs in the browser. A small backend for the AI calls and the world cache is planned but not built.

- **Client:** TypeScript (strict) with Vite. Three.js for the 3D world, and a plain 2D canvas for the microscope view. Vitest for tests and ESLint for module boundaries; `npm run check` runs typecheck, lint and tests.
- **Data:** recipes, materials, samples, scientists (`npcs.json`), achievements, the object catalog and the default world spec are JSON files in `data/`, validated by Zod schemas that are also the TypeScript types. Cross-references (a recipe input that does not exist, a sample on an unknown object, a request for an unknown discovery or mini-game) fail the tests.
- **Backend (deferred):** one small Node service that would call the LLM, validate specs with the shared validator and cache worlds as JSON files.
- **External data (stretch):** the Materials Project for crystal structures and abTEM for simulated atomic images.

**Two views, one state.** The 3D world and the 2D microscope view both read the same plain TypeScript modules for inventory, recipes, microscope tier and discoveries, and neither renderer owns that data. State changes only through a few actions (gather, craft, discover, set zoom, complete a request, record a score, visit an area), and each one announces itself on a small event bus and re-checks the achievements. The simulation module has no 3D or DOM dependency, so the eyepiece view and the formulas are tested without a browser. Aiming at an object and pressing a key switches from the world to the eyepiece.

The world sits behind one function, `mountWorld(el, ctx)`. If the 3D world ever falls behind, a 2D tile world with the same signature can replace it without touching the rest.

## Module design

The code is split into four owned modules around one shared core, so four people can build in parallel without editing the same files. Every module depends on the shared core, and none depends on another module; ESLint enforces this.

*Figure: module dependencies.* Four modules (3D world, Microscope view, AI and backend, Content and UI) each depend on one shared core (src/shared). The shared core never imports Three.js or the DOM, and modules never import each other. (This figure is a drawing in the online doc.)

| Module | Folder | Owner | Exposes |
| --- | --- | --- | --- |
| Shared core | src/shared | Everyone; changes announced first | Schemas and types, game state and actions, event bus, simulation rules and mini-game physics, wall explanations, Microdex view-model, achievements and conditions, world-spec validator |
| 3D world | src/world | Person A | Terrain, buildings, procedural models, scenery, scientists, player movement, gathering, aiming, sample pickers, carried samples, sites and areas, tracking |
| Microscope view | src/scope | Person B | 2D canvas view with zoom, focus, imaging modes, stains, beam damage, drawings by feature type, and one panel per mini-game; also owns the simulation rules and their tests |
| AI and backend | src/guide, server | Person C | Guide (offline today), world-spec validator; planner, world cache and endpoints are deferred |
| Content and UI | src/ui, data | Person D | Goal card, inventory box, tech tree, Microdex, journal, scientist dialogs, toasts, sound, guide box; recipe, material, sample, scientist and achievement JSON |

**The shared contract** was written first, and every module builds on it:

- Types and JSON schemas for recipes, materials, samples, game state and the world spec live in src/shared (Zod) and are checked by tests.
- A small event layer connects the modules: openEyepiece(sampleId), closeEyepiece(), itemGathered, itemCrafted(itemId), discoveryUnlocked(id), tierChanged, zoomChanged, scopeChanged (player picked another owned microscope), trackItem and trackTarget, talkTo(npcId), questCompleted, achievementUnlocked, minigameScored, areaVisited, guideAsked and guideReplied.
- src/shared imports nothing from Three.js or the DOM, so the simulation runs in tests and in the backend.
- A change to a shared type is announced to the team before it is merged (see the README's Contributing section).

**Stubs kept everyone unblocked.** The first commit had a flat plane with one cube, a fake eyepiece, canned guide replies and a fixed world spec. Each owner has since replaced theirs in their own folder.

## Team roles and build timeline

The team has four people and the build window is not fixed yet (see open questions), so the plan is written as ordered phases with a gate after each.

| Role | Owns |
| --- | --- |
| Person A: 3D world | Terrain, models, scenery, player controls, gathering, aiming at objects, the key that opens the eyepiece |
| Person B: microscope view and simulation | 2D canvas view, formulas and their tests, the "hit a wall" logic |
| Person C: AI and backend | Planner prompt, JSON schema, validator, world cache, guide NPC |
| Person D: content and UI | Recipes, materials, samples, Microdex, crafting UI, sound, README, demo script, playtests |

1. **Setup.** Shared contract, tooling and stubs. Gate: every module runs on its own. Done.
2. **Vertical slice.** Gather, craft and build a hand lens, and see leaf veins. Gate: the full loop works once. Done.
3. **Simulation and tiers.** Tiers 2 and 3, zoom and focus, the wall messages. Gate: a playtester climbs three tiers. Built; playtest pending.
4. **Content.** The Microdex and about a dozen samples. Gate: the log fills as the player explores. Done.
5. **AI layer.** Guide NPC, then prompt-to-world. Gate: a typed prompt produces a playable world. Offline guide done; LLM parts deferred.
6. **Polish and demo.** Tier 5 showpiece, sounds, open-world look, demo script. Gate: a clean five-minute run. Built; rehearsal pending.

## Build status
Built and tested (87 automated tests across 11 files, plus checks in the browser): the shared contract with imaging modes, stains, sites and conditions; tiers 0 to 7 with zoom steps, focus, beam damage and per-instrument alignment; 70 recipes; 170 discoveries; the discovery gates for every tier; the seven mini-games with their physics; 15 scientists with 53 requests; 113 achievements and the journal; the offline guide; the goal card, inventory box, tech tree (with add-ons), Microdex (with tracking) and toasts; the campus with the greenhouse and Wilson Lab; saving progress between sessions (older saves load with the new fields empty); synthesised sounds; a demo mode (`?demo`, press K to restock materials).

Not built: the LLM planner and guide calls, the server and world cache, music and a tutorial, stations as places in the world.

Not yet checked: a playtest of the full 10-hour arc (how long gathering for the TEM, STEM and beamline feels, and whether the mini-games are too hard or too easy), review of the physics numbers and the scientists' texts by experts, and play on more than one browser.

## Risks and mitigations

Scope is the biggest risk, because a crafting system, a world and an AI layer is a lot for one event. The 3D world is the part to watch: it is behind one function, so if it falls behind or runs slowly on a demo machine, swap it for 2D tiles, since the shared state and the microscope view do not depend on it.

| Risk | Mitigation |
| --- | --- |
| Scope grows past the build window | Ship tiers 1 to 3 and the electron showpiece; finish one loop before adding content |
| The game teaches something wrong | Keep rules simple, label simplifications (such as the non-relativistic electron wavelength and the single-exponential beam damage), and have a microscopy expert review the numbers |
| Microscope views are not impressive | Procedural scenes with blur and zoom by the real formulas; a computed electron view with a lattice |
| The 3D world is slow on the demo machine | Instanced scenery and shared geometry keep draw calls low; fall back to a smaller map or 2D tiles |
| LLM output is invalid or unphysical | Fixed catalog, schema validator, one retry, and a default fallback world (validator built) |
| Model latency or an outage during the demo | Generate worlds ahead of time, cache them, and pre-generate the demo prompts |
| The game is not fun | Playtest with someone outside the team as soon as possible |
| Data or image licensing | Everything visual is generated in code; credit any open datasets used later in the game and README |

## Demo script and judging pitch

The demo shows the whole idea in about ten minutes: a player builds a tool and the world gets smaller. The step-by-step script with exact crafting and walking directions is in the README; this is the outline. Open the game with `?demo` so that K restocks materials.

1. **Start with a blurry world.** The player holds nothing and looks at a leaf: the fine veins are blurred away.
2. **Build a hand lens.** Gather sand and iron, smelt glass, craft the lens, then aim at a leaf and press a key to look through it and see leaf veins.
3. **Discover to unlock, then upgrade.** The hand lens reveals copper in a plain rock, which unlocks the lamp and the compound microscope. It shows cells and pond algae, and the guide explains why more magnification alone stopped helping.
4. **Reach the diffraction limit.** Oil found in a sunflower seed under the compound microscope unlocks the high-quality microscope. With oil immersion it shows bacteria, and the banner explains why viruses stay out of reach.
5. **Align the light.** Köhler illumination on the diatom test slide resolves Amphipleura's 0.25 µm striae, the old test of the best lenses; Ernst Abbe asks to see them.
6. **Electrons, part by part.** Willemite, which glows green under the fluorescence microscope, makes the TEM's screen. Aligned, the TEM resolves gold's 0.235 nm planes; the STEM's corrector makes single atoms shine; ptychography reaches the 0.39 Å record.
7. **Synchrotron light.** Monazite and beryl unlock the CHESS beamline: tune the undulator to map cobalt in vitamin B12 for Dorothy Hodgkin, record Photo 51 for Rosalind Franklin, find the trilobite hidden in the shale.
8. **Type a prompt (when built).** The presenter enters a sentence and a new world appears with its own hidden scales. This step needs the LLM work and is skipped in the current demo.

For judges, the pitch has four points:

- **Fit.** The game applies LLMs and multimodal models to materials science and physics education, the hackathon's stated focus.
- **Grounded.** Worlds come from structured specs and real structure data, not free-form model output; today the same numbers drive the game's own explanations.
- **Educational by design.** Players learn by building the instrument, and every upgrade has a physical reason.
- **Extensible.** Recipes, samples and object types are data files, and the agent benchmark could feed the collaborative papers the organizers describe.

## Open questions

- [x] Is the 3D world worth its cost? Yes: it is built as a walkable open world with procedural models. It stays behind `mountWorld`, so a 2D tile world can still replace it.
- [x] Browser game, or a mod or engine such as Luanti? Browser game (TypeScript, Vite, Three.js).
- [ ] Who takes each of the four roles: 3D world, microscope view and simulation, AI and backend, content and UI?
- [ ] How long is the build window?
- [ ] Which age group do we target first: middle school, high school or early undergraduate?
- [ ] Which LLM and API will power the planner and the guide? Deferred with the LLM features.
- [ ] What are the hackathon's tracks, judging criteria and submission format? The event page does not list them.
- [ ] Do the discovery gates feel rewarding? Option if they feel like busywork: make the plain rocks and seeds also glimmer faintly so players know to look, or add a hint from the guide after a minute without progress.
- [ ] Should crafting stations (furnace, bench) become places in the world, or stay a panel?
- [x] Should the electron wavelength use the relativistic formula? Yes, now relativistic.
- [ ] Is the late-game gathering (about 12 iron and 11 copper for the STEM and beamline) satisfying or a grind? Options: more nodes, or components that drop from scientists' requests.
- [ ] Should the scientists speak in the first person? They do now, from their documented work; every NPC is a historical figure who has died, and no living scientist is given invented words.
