# MicroscopeCraft – Game Design Document

October 21, 2026 · Yi Jiang · Updated October 21, 2026 to match the build (see "Build status")

## Vision

MicroscopeCraft is an open-world exploration game where you build every microscope yourself, from a hand lens to an electron microscope, and use each one to see a smaller world. The world is a walkable 3D landscape with realistic objects, and you play it the way you play a sandbox game: roam freely, gather what you find, craft, and build.

*Build the instrument. See the invisible.*

Five design pillars guide every decision:

- **Build to see.** Every new view of the world is earned by building a better instrument.
- **Real physics, simple rules.** Material and optics choices change what you can see, and the rules are directionally correct.
- **Wonder before jargon.** The first zoom happens within minutes, and terms appear only when a player needs them.
- **Every upgrade has a reason.** Each microscope hits a visible limit that the next tier solves.
- **Discovery gates progress.** A better microscope needs a material that only the previous microscope could recognise, so the instrument you built is what lets you build the next one.
- **Worlds from a prompt.** An LLM turns a sentence such as "a drop of pond water" into a playable, scale-layered world. (Designed and validated, not built yet; see "Build status".)

The game is built for the [4th Annual Open Scientific Intelligence Hackathon](https://luma.com/ku88xh92), a hybrid event focused on LLMs, agents and multimodal models for materials science, chemistry, physics and math.

## Audience and goals

The primary audience is students from about age 12 to first-year undergraduate who already play sandbox games and have no microscopy background. Secondary audiences are teachers, who can generate a world from a prompt, and outreach staff at microscopy facilities.

Players should feel surprise at each new scale and pride that they built the tool that revealed it. Over a full playthrough they should learn four ideas, in this order:

1. **Magnification and focal length.** Lenses bend light, and their shape sets how much.
2. **Resolution.** More magnification adds no detail past a limit set by wavelength and lens quality.
3. **Contrast.** A feature can be large enough to resolve and still be invisible without contrast.
4. **Electrons and damage.** Electrons see smaller than light does, and the beam can destroy the sample.

Success is checked in playtests before the demo: a new player builds a second-tier microscope without help, and can say in their own words why their first microscope could not see bacteria.

## Core gameplay loop

Every session repeats one loop, at smaller and smaller scales:

1. **Explore and gather.** Walk the landscape and collect sand, ore, plant oil, resin and other raw materials. The game never leaves the player lost: a goal panel names the next microscope, lists what is still needed and where it is found, and an arrow with the distance points to the nearest source, and a small marker floats over it when the player is close.
2. **Identify.** Some materials look like plain rock or seeds until you look at them through the microscope you already have. Spotting what is inside unlocks gathering them (see "Discovery gates").
3. **Craft and assemble.** Smelt sand into glass, grind lenses, forge frames and tubes, then craft the microscope from its parts. The goal card lists the steps and the C key crafts the next ready one.
4. **Look.** Aim at a sample, press a key to look through the instrument, and focus; the view shows only what the instrument can resolve.
5. **Hit a wall.** The view is blurry, empty or too dark, and the game explains the limit in plain words, using the simulation's own numbers.
6. **Upgrade.** Gather better materials, craft better parts and return to step 3.

One pass takes a few minutes, and the climb through microscope tiers is the long arc. A discovery log (the Microdex) records everything the player has seen and gives a collection goal. Failure is gentle: gathered materials grow back, a damaged sample resets when the eyepiece closes, and the game has no death.

## Microscope tech tree

The tree follows the real history of microscopy in six tiers. Each tier ends at a wall the player can observe, and the next tier is the fix. Tier numbers keep the gaps (no 4 or 6 yet) so those tiers can be added without renumbering.

| Tier | What you build | Physics learned | Wall that motivates the next tier |
| --- | --- | --- | --- |
| 0. Naked eye | Nothing | The eye resolves about 0.1 mm | Fine veins and grains blur together |
| 1. Hand lens | One glass lens in a frame | Magnification, focal length, lens shape | Cells and other tiny things are still too small |
| 2. Compound microscope | Two lenses, a tube, a lamp and a focus knob; four zoom settings | Objective versus eyepiece, illumination, focus | Pushing magnification higher only makes a bigger blur |
| 3. High-quality optics | Pure quartz glass, a condenser, immersion oil | Aberrations, numerical aperture, the diffraction limit | Visible light cannot resolve anything smaller than about half its wavelength |
| 4. Contrast methods (staining built as a mini-game) | Saffron stain (built); dark field and fluorescence parts (not built) | Contrast, why staining and labeling help | Light itself is still the limit |
| 5. Electron microscope | Tungsten filament, vacuum chamber, magnetic lenses | Wavelength versus resolution, vacuum, beam damage | Lens errors and sample damage cap the detail |
| 6. Aberration-corrected STEM (not built) | Correctors and a stable stage | Imaging individual atoms | End of the tree |

### Discovery gates

To build a microscope above the first, the player needs a material that is only recognisable through the microscope below it. Until the player has seen it (and its Microdex card unlocks), the material cannot be gathered: the rocks are plain grey, the seeds are just seeds, and pressing E says "not identified yet". After the discovery the rocks show their ore and E works. The rule is data: a material lists `unlockedBy`, the id of a discovery. A test fails if any tier above the first lacks such a gate, or if the gate is not visible with the previous tier.

| To build | Material that is gated | Discovered with | What the player sees |
| --- | --- | --- | --- |
| Compound microscope | Copper ore (lamp) | Hand lens | Green copper veins in a plain grey rock |
| High-quality microscope | Plant oil (immersion oil) | Compound microscope | Oil droplets inside a sunflower seed |
| Electron microscope | Tungsten ore (filament) | High-quality microscope | Dark tungsten grains inside a heavy grey rock |

The sizes are chosen so each gate really is out of reach of the tier before it: copper veins (50 µm) need the hand lens's 30 µm resolution, seed oil droplets (8 µm) need the compound microscope's 1.5 µm, tungsten grains (0.8 µm) need the high-quality microscope's 0.2 µm. The goal card shows an "Identify" row ahead of the gather rows, with what to look at and which microscope to use.

Tiers 0 to 3 and 5 are playable. Higher-tier microscopes do not replace lower ones: a new microscope becomes the one you look through, but every microscope you own stays in the inventory (the high-quality microscope needs the compound microscope you built first, yet does not use it up). Inside the eyepiece an instrument picker (keys 1, 2, 3 or the buttons) switches between them, so the same sample can be compared at tier 1, 2, 3 and 5; zoom steps and focus follow the chosen instrument. The goal card always follows the best microscope owned, not the one picked.

## Materials and crafting

Material choice is the main decision in the game: the properties of what you gather set the quality of what you build. Each resource carries a few numeric properties that feed the simulation model.

| Resource | Crafted part | Property that matters | Effect in game |
| --- | --- | --- | --- |
| Beach sand | Basic glass lens | Impurity level | Impure glass blurs the image (lens blur of 30 µm in a hand lens, 1 µm in the compound microscope) |
| Quartz sand | High-quality lens | Purity, low dispersion | Much smaller lens blur (0.05 µm) |
| Iron ore | Frame, tube, focus knob, coils | Strength | Needed to assemble the instrument |
| Copper ore (identify with the hand lens) | Lamp, condenser, coils | Conductivity | Needed for the light source and the magnetic lenses |
| Plant oil (identify with the compound microscope) | Immersion oil | Refractive index | Raises numerical aperture, so finer detail resolves (up to NA 1.3) |
| Tungsten ore (identify with the high-quality microscope) | Electron-source filament | Melting point | Needed to emit a steady electron beam |
| Resin | Vacuum seals | Leak rate | Needed for the vacuum chamber |
| Glass slides and cover slips (not built) | Sample holders | Thickness, flatness | Thin, flat samples are easier to focus |
| Natural dyes: saffron, from the quad's flowers (others not built) | Stains, applied in the staining lab | Which structures they bind | Raise contrast for chosen features |

The goal panel lists the crafts in order and highlights the next one; the full recipe list is a click away. The guide answers "where do I find X?", "how do I make X?" and "what next?" from the same data (each raw material carries a where-to-find hint in its JSON). Crafting happens in the crafting panel, which labels each recipe with its station (furnace or bench). Stations are not yet places in the world, so any recipe can be crafted from the panel. Recipes are data (JSON): there are 18 now, and adding a part means adding one entry. The raw materials for the whole tree are: 8 beach sand, 6 quartz sand, 7 iron, 6 copper, 1 plant oil, 1 tungsten and 2 resin. Each material carries a where-to-find hint, which the goal card and the guide show. Materials grow back 15 seconds after they are gathered.

## World and scale content

The world is a small open 3D landscape, about 190 m across, that the player walks, runs and jumps through in first person. It is built entirely from procedural models and textures generated in code, so there are no art assets to license: a university campus (a quad lined with stone halls, a clock tower, a long slope, a gorge with a waterfall, a lake, and a science building), with tens of thousands of instanced grass blades, flowers and trees, a sky, soft shadows and distance fog. Gatherable things are real-looking models, not blocks: noise-shaped ore rocks with colored veins, mounds of sand, quartz crystal clusters, veined leaves, flowers, sunflowers, resin-dripping stumps and a butterfly wing on a stone. Aiming is forgiving (a ring and a prompt show what the crosshair is on), and the player collides with buildings, trees, rocks and gatherables. The electron microscope is installed in the science lab and works only there: the player carries samples to it.

| Area | Where | What the player finds |
| --- | --- | --- |
| Quad | Centre | Leafy plants, flowers, a butterfly wing, sunflowers (look at a seed under the compound microscope), lawn, paths and elms |
| Lake | North-east (spawn) | Lake water to sample, sand along the south shore, the waterfall into the gorge |
| Gorge rim and west slope | North and west | Iron rocks, quartz crystals, and plain grey and heavy grey rocks that hide copper and tungsten, boulders |
| Lower west slope | South-west | Resin stumps among pines |
| Science building | South-east | The electron microscopy lab on the glass ground floor; a glowing crystal outside. The electron microscope only works here, so samples are carried in |

Every sample has a hidden layer at each smaller scale, and a layer appears only when the player's microscope can resolve it. Sizes below are approximate.

| Tier | Typical feature size | What the player can discover |
| --- | --- | --- |
| 1 | About 0.1 mm and below | Leaf veins, sand grain facets, wing veins, petal hairs, copper veins |
| 2 | About 10 to 100 µm | Leaf cells, pollen, wing scales, pond algae, seed oil droplets |
| 3 | About 1 µm | Bacteria in pond water, tiny pits on a quartz grain, tungsten grains |
| 4 | About 1 µm and up, with contrast | Transparent cells revealed by a stain: an amoeba in the lake, nuclei in leaf cells (built); labeled structures (not built) |
| 5 | About 10 to 100 nm | Viruses, crystal grains, the atomic lattice |
| 6 | About 0.1 to 0.4 nm | Single atomic columns (not built) |

The Microdex is a collection log with one card per discovery: a picture of what the player actually saw (kept as their sharpest view), its size, and a two-sentence explanation. Cards are grouped by biome with progress and a completion mark, and a biome with no samples yet would show as locked (all four have samples now). The build has 19 discoveries across 10 hand-authored samples; three of them (copper veins, seed oil, tungsten grains) unlock materials, and two (an amoeba, leaf-cell nuclei) only show once stained. A discovery toast appears the first time something is seen.

## Simulation model

Four small formulas decide what the player sees. They are simplified but directionally correct, so a better material or a smaller wavelength always helps for the right reason. All lengths are in micrometres in the code.

Total magnification is the product of the two lens stages (each microscope lists its zoom settings, and the objective's numerical aperture changes with the setting):

$$M = M_{obj} \cdot M_{eye}$$

The smallest detail a light microscope can resolve (the Abbe limit) depends on wavelength and numerical aperture:

$$d_{diff} = \frac{\lambda}{2\,NA}$$

For electrons the wavelength comes from the accelerating voltage V in volts (non-relativistic form, used as a game simplification; it is about 10% off at 200 kV):

$$\lambda_{e}\,[\mathrm{nm}] \approx \frac{1.226}{\sqrt{V}}$$

Lens defects add blur on top of the diffraction limit. Each microscope's defect size is part of its recipe:

$$d_{eff} = \sqrt{d_{diff}^{2} + d_{lens}^{2}}$$

Focus adds to the lens blur: from tier 2 up, defocus blur is the distance from sharp focus times the numerical aperture, so high-power objectives are fussier, as in real microscopes.

A feature appears in the view only if three rules pass, checked in the order the player hits the walls:

1. **Resolved.** The feature is at least as large as $d_{eff}$. If not, the view says "unresolved", or "empty magnification" when the zoom is already past the useful limit of about 1000 × NA (light microscopes only; electron images are digital and have no such limit).
2. **Visible to the eye.** The feature's size times M reaches the eye's limit of about 0.1 mm; otherwise it is "too small to see".
3. **Contrast.** The sample's contrast, scaled by stains and the imaging method, is above a threshold of 0.1; otherwise "low contrast".

**Staining (the staining lab mini-game).** A clear feature (contrast below 0.1) hits the contrast wall even when it is resolved. A dye soaks into the target and its background at different rates, both first-order (uptake $1 - e^{-t/\tau}$, with the target about 4× faster, $\tau_t \approx 1.5$ s and $\tau_b \approx 6$ s), so the added contrast is

$$C(t) = e^{-t/\tau_b} - e^{-t/\tau_t}$$

It peaks at $t^* = \ln(\tau_b/\tau_t)\,\tau_t\tau_b/(\tau_b - \tau_t)$, about 2.8 s, then falls as the background catches up (overstaining). The player rinses by eye; the stain quality $q = C(t)/C(t^*)$ moves the feature's contrast toward the dye's ($c + (c_{dye} - c)\,q$). Each attempt varies both rates by up to 25% so the peak has to be watched, not timed. Simplifications: one dye, no washing-out, and the electron microscope ignores stains.

At tier 5 the player also manages dose, the number of electrons per unit area:

$$D = \frac{I \cdot t}{A}$$

Each fragile sample has a critical dose $D_c$ and its signal fades as $e^{-D/D_c}$. Zooming in shrinks the imaged area A and raises the dose rate, so a virus dies in seconds at 150,000× and survives minutes at 50,000×. This is the same tradeoff real microscopists face. Simplification: damage applies to the whole sample, and the beam current is a game value.

Every simplification is labeled in a code comment next to its formula. The wall explanations (`explainWall`) are built from these numbers (your resolution, the feature size, NA, dose), and both the eyepiece banner and the guide use them, so they always say the same true thing.

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

The MVP is one complete play loop that can be demoed in about five minutes: gather, craft, see something new, upgrade. Anything beyond that loop is faked or left as a stretch goal.

| Area | Must ship | Faked or hand-authored | Stretch | Status |
| --- | --- | --- | --- | --- |
| World | One small open 3D map with a meadow and a pond | Other biomes shown as locked areas | Mine and workshop biomes | Built, and larger than planned: a campus map (quad, slope, gorge, lake, science lab) |
| Crafting | About eight recipes: glass, lens, frame, tube, light source, immersion oil | Recipe values tuned by hand | Full materials property system | 18 recipes, values tuned by hand |
| Microscopes | Tiers 1 to 3, working end to end | Tier 5 as a scripted showpiece view | Tiers 4 and 6 | Tiers 0 to 3 and 5 built; tier 5 is a computed view with beam damage, not scripted |
| Samples | About ten hand-authored discoveries in the Microdex | Atomic view drawn from a prepared image | Samples generated from a prompt | 19 discoveries; the atomic lattice is drawn procedurally |
| AI | Guide grounded in the simulation's numbers | Prompt-to-world limited to three or four templates | Materials Project lookup, abTEM images, agent benchmark | Offline guide only; LLM features deferred |
| Polish | Simple art, readable UI, one sound per action | Placeholder music | Tutorial and teacher mode | Procedural 3D art, synthesised sounds, demo script; no music or tutorial |

## Technical architecture

The game runs in the browser. A small backend for the AI calls and the world cache is planned but not built.

- **Client:** TypeScript (strict) with Vite. Three.js for the 3D world, and a plain 2D canvas for the microscope view. Vitest for tests and ESLint for module boundaries; `npm run check` runs typecheck, lint and tests.
- **Data:** recipes, materials, samples, the object catalog and the default world spec are JSON files in `data/`, validated by Zod schemas that are also the TypeScript types. Cross-references (a recipe input that does not exist, a sample on an unknown object) fail the tests.
- **Backend (deferred):** one small Node service that would call the LLM, validate specs with the shared validator and cache worlds as JSON files.
- **External data (stretch):** the Materials Project for crystal structures and abTEM for simulated atomic images.

**Two views, one state.** The 3D world and the 2D microscope view both read the same plain TypeScript modules for inventory, recipes, microscope tier and discoveries, and neither renderer owns that data. State changes only through a few actions (gather, craft, discover, set zoom), and each one announces itself on a small event bus. The simulation module has no 3D or DOM dependency, so the eyepiece view and the formulas are tested without a browser. Aiming at an object and pressing a key switches from the world to the eyepiece.

The world sits behind one function, `mountWorld(el, ctx)`. If the 3D world ever falls behind, a 2D tile world with the same signature can replace it without touching the rest.

## Module design

The code is split into four owned modules around one shared core, so four people can build in parallel without editing the same files. Every module depends on the shared core, and none depends on another module; ESLint enforces this.

*Figure: module dependencies.* Four modules (3D world, Microscope view, AI and backend, Content and UI) each depend on one shared core (src/shared). The shared core never imports Three.js or the DOM, and modules never import each other. (This figure is a drawing in the online doc.)

| Module | Folder | Owner | Exposes |
| --- | --- | --- | --- |
| Shared core | src/shared | Everyone; changes announced first | Schemas and types, game state and actions, event bus, simulation rules, wall explanations, Microdex view-model, world-spec validator |
| 3D world | src/world | Person A | Terrain, procedural models, scenery, player movement, gathering, aiming, opening the eyepiece |
| Microscope view | src/scope | Person B | 2D canvas view with zoom, focus, beam damage and drawings by feature type; also owns the simulation rules and their tests |
| AI and backend | src/guide, server | Person C | Guide (offline today), world-spec validator; planner, world cache and endpoints are deferred |
| Content and UI | src/ui, data | Person D | Goal card, inventory box, crafting menu, Microdex, toasts, sound, guide box, recipe, material and sample JSON |

**The shared contract** was written first, and every module builds on it:

- Types and JSON schemas for recipes, materials, samples, game state and the world spec live in src/shared (Zod) and are checked by tests.
- A small event layer connects the modules: openEyepiece(sampleId), closeEyepiece(), itemGathered, itemCrafted(itemId), discoveryUnlocked(id), tierChanged, zoomChanged, scopeChanged (player picked another owned microscope), guideAsked and guideReplied.
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

Built and tested (62 automated tests, plus manual checks in the browser): the shared contract; the staining lab mini-game (saffron from the flowers, S in the eyepiece, two stainable discoveries); tiers 0, 1, 2, 3 and 5 with zoom steps, focus and beam damage; the wall messages; 18 recipes; 19 discoveries in the Microdex; the offline guide (including where-to-find and what-next answers); the discovery gates; a keyboard-first goal card (the next action in one line, a checklist, C to craft, an arrow to the nearest source), an always-visible inventory box (materials, parts, microscopes with the one in use marked; I toggles it), an in-eyepiece instrument picker for comparing microscopes, a Tab menu and toasts; the open world with procedural models; synthesised sounds; a demo mode (`?demo`, press K to restock materials).

Not built: the LLM planner and guide calls, the server and world cache, tier 6, dark field and fluorescence, stations as places in the world, saving progress between sessions, music and a tutorial.

Not yet checked: whether the discovery gates feel like discovery or like busywork in a playtest; a playtest with someone outside the team, review of the physics numbers and the wall wording by a microscopy expert, and play with real mouse and keyboard on more than one browser.

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

The demo shows the whole idea in about five minutes: a player builds a tool and the world gets smaller. The step-by-step script with exact crafting and walking directions is in the README; this is the outline. Open the game with `?demo` so that K restocks materials.

1. **Start with a blurry world.** The player holds nothing and looks at a leaf: the fine veins are blurred away.
2. **Build a hand lens.** Gather sand and iron, smelt glass, craft the lens, then aim at a leaf and press a key to look through it and see leaf veins.
3. **Discover to unlock, then upgrade.** The hand lens reveals copper in a plain rock, which unlocks the lamp and the compound microscope. It shows cells and pond algae, and the guide explains why more magnification alone stopped helping.
4. **Reach the diffraction limit.** Oil found in a sunflower seed under the compound microscope unlocks the high-quality microscope. With oil immersion it shows bacteria, and the banner explains why viruses stay out of reach.
5. **Show the electron microscope.** Tungsten spotted under the high-quality microscope unlocks it. It shows a virus (which the beam slowly destroys) and the atomic lattice of a crystal in the lab, and the guide explains why electrons see smaller than light.
6. **Type a prompt (when built).** The presenter enters a sentence and a new world appears with its own hidden scales. This step needs the LLM work and is skipped in the current demo.

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
- [ ] Should the electron wavelength use the relativistic formula? It would be about 10% more accurate at 200 kV.
