# MicroscopeCraft – Game Design Document

October 21, 2026 · Yi Jiang

## Vision

MicroscopeCraft is a Minecraft-style open-world game where you build every microscope yourself, from a hand lens to an electron microscope, and use each one to see a smaller world.

*Build the instrument. See the invisible.*

Five design pillars guide every decision:

- **Build to see.** Every new view of the world is earned by building a better instrument.
- **Real physics, simple rules.** Material and optics choices change what you can see, and the rules are directionally correct.
- **Wonder before jargon.** The first zoom happens within minutes, and terms appear only when a player needs them.
- **Every upgrade has a reason.** Each microscope hits a visible limit that the next tier solves.
- **Worlds from a prompt.** An LLM turns a sentence such as "a drop of pond water" into a playable, scale-layered world.

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

1. **Explore and gather.** Collect sand, ore, plant fibers and other raw materials from the world.
2. **Craft parts.** Smelt sand into glass, grind lenses, forge frames and tubes.
3. **Assemble.** Place the parts in the right order on the Build Bench to make a microscope.
4. **Look.** Aim the microscope at a sample and focus; the view shows only what the instrument can resolve.
5. **Hit a wall.** The view is blurry, empty or too dark, and the guide explains the limit in plain words.
6. **Upgrade.** Gather better materials, craft better parts and return to step 3.

One pass takes a few minutes, and the climb through microscope tiers is the long arc. A discovery log (the Microdex) records everything the player has seen and gives a collection goal. Failure is gentle: a ruined sample can be gathered again, and the game has no death.

## Microscope tech tree

The tree follows the real history of microscopy in six tiers. Each tier ends at a wall the player can observe, and the next tier is the fix.

| Tier | What you build | Physics learned | Wall that motivates the next tier |
| --- | --- | --- | --- |
| 1. Hand lens | One glass lens in a frame | Magnification, focal length, lens shape | Cells and other tiny things are still too small |
| 2. Compound microscope | Two lenses, a tube, a light source and a focus knob | Objective versus eyepiece, illumination, focus | Pushing magnification higher only makes a bigger blur |
| 3. High-quality optics | Pure glass, a condenser, immersion oil | Aberrations, numerical aperture, the diffraction limit | Visible light cannot resolve anything smaller than about half its wavelength |
| 4. Contrast methods | Dark field and fluorescence parts | Contrast, why staining and labeling help | Light itself is still the limit |
| 5. Electron microscope | Electron source, vacuum chamber, magnetic lenses | Wavelength versus resolution, vacuum, beam damage | Lens errors and sample damage cap the detail |
| 6. Aberration-corrected STEM | Correctors and a stable stage | Imaging individual atoms | End of the tree |

The hackathon build covers tiers 1 to 3 in full and tier 5 as a showpiece (see the MVP section).

## Materials and crafting

Material choice is the main decision in the game: the properties of what you gather set the quality of what you build. Each resource carries a few numeric properties that feed the simulation model.

| Resource | Crafted part | Property that matters | Effect in game |
| --- | --- | --- | --- |
| Beach sand | Basic glass lens | Impurity level | Impure glass tints and blurs the image |
| Quartz sand | High-quality lens | Purity, low dispersion | Less color fringing and blur at the edges |
| Iron and copper ore | Frame, tube, focus knob, coils | Strength, conductivity | Stable frame reduces drift; coils steer electrons |
| Plant or animal oil | Immersion oil | Refractive index | Raises numerical aperture, so finer detail resolves |
| Tungsten ore | Electron-source filament | Melting point | Needed to emit a steady electron beam |
| Rubber or resin | Vacuum seals | Leak rate | A leaky chamber scatters the beam and blurs the image |
| Glass slides and cover slips | Sample holders | Thickness, flatness | Thin, flat samples are easier to focus |
| Natural dyes | Stains | Which structures they bind | Raise contrast for chosen features |

Crafting happens at a Build Bench. Recipes are data (JSON), so adding a part means adding one entry, which also makes the game easy to extend during the hackathon.

## World and scale content

The world is a small open 3D map with four biomes: a meadow, a pond, a mine and a workshop lab. Every object has a hidden layer at each smaller scale, and a layer appears only when the player's microscope can resolve it. Sizes below are approximate.

| Tier | Typical feature size | What the player can discover |
| --- | --- | --- |
| 1 | About 0.1 mm and up | Sand grains, hair, leaf veins, insect wings |
| 2 | About 10 to 100 µm | Pollen, onion cells, pond algae |
| 3 | About 1 µm | Bacteria in pond water, mineral grain texture |
| 4 | About 1 µm, with contrast | Transparent cells, stained or labeled structures |
| 5 | About 10 to 100 nm | Viruses, nanoparticles, crystal grains and boundaries |
| 6 | About 0.1 to 0.4 nm | The atomic lattice of a crystal |

The Microdex is a collection log with one card per discovery: a drawing of what the player saw, its size, and a two-sentence explanation. Completing a biome's cards unlocks its next sample set. Samples in the demo build are hand-authored, and the prompt-to-world generator (see AI features) produces more.

## Simulation model

Four small formulas decide what the player sees. They are simplified but directionally correct, so a better material or a smaller wavelength always helps for the right reason.

Total magnification is the product of the two lens stages:

$$M = M_{obj} \cdot M_{eye}$$

The smallest detail a light microscope can resolve (the Abbe limit) depends on wavelength and numerical aperture:

$$d_{diff} = \frac{\lambda}{2\,NA}$$

For electrons the wavelength comes from the accelerating voltage V in volts (non-relativistic form, used as a game simplification):

$$\lambda_{e}\,[\mathrm{nm}] \approx \frac{1.226}{\sqrt{V}}$$

Lens defects add blur on top of the diffraction limit. Each part's defect size comes from its material properties:

$$d_{eff} = \sqrt{d_{diff}^{2} + d_{lens}^{2}}$$

A feature appears in the view only if three rules all pass:

1. **Resolved.** The feature is at least as large as $d_{eff}$.
2. **Visible to the eye.** The feature's size times M reaches the eye's limit of about 0.1 mm; below that the view is too small, and above what $d_{eff}$ allows it is "empty magnification" and shows only blur.
3. **Contrast.** The sample's contrast, set by its type, stains and the imaging method, is above a threshold.

At tier 5 the player also manages dose, the number of electrons per unit area:

$$D = \frac{I \cdot t}{A}$$

Each sample has a critical dose. Zooming in shrinks the imaged area A and raises D, so a fragile sample dies if the player zooms and lingers. This is the same tradeoff real microscopists face.

## AI features

The LLM never draws the world. It writes a structured description, and the game's own generators turn that into content. This keeps worlds consistent, fast and physically sensible.

**Prompt-to-world generator.** A teacher or player types a sentence such as "a drop of pond water" or "a perovskite solar cell". A planner model returns a JSON spec of objects at each scale. A validator checks it against a fixed catalog of object types and size ranges, and sends one error message back to the model for a retry if it fails. The generators then build the content, and the world is cached so no model call happens during play.

*Figure: prompt-to-world pipeline.* Prompt → Planner (LLM) → Valid? If yes → Generators → Playable world. If no, the error is sent back to the planner for one retry, then the game falls back to a default world. (This figure is a drawing in the online doc.)

A valid spec is cached, so the game never waits on the model during play.

Example spec:

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

**Grounding in real data.** For materials prompts, the model names the material and the game looks up its real structure in a database such as the Materials Project, so lattice type and spacing are facts, not guesses. Organism sizes come from a small hand-checked table. If time allows, atomic-resolution images are simulated with abTEM from the real structure.

**Guide NPC.** A character that sees the player's current build and view and answers questions such as "why is my image blurry?" in plain words. Its answers are grounded in the simulation's own numbers ($d_{eff}$, contrast, dose), so it explains the actual cause.

**Agent benchmark (stretch).** An LLM agent plays the same crafting loop through an API, which gives a measurable test of how well agents plan and characterize unknown materials.

## MVP scope for the hackathon

The MVP is one complete play loop that can be demoed in about five minutes: gather, craft, see something new, upgrade. Anything beyond that loop is faked or left as a stretch goal.

| Area | Must ship | Faked or hand-authored | Stretch |
| --- | --- | --- | --- |
| World | One small 3D voxel-style map with a meadow and a pond | Other biomes shown as locked areas | Mine and workshop biomes |
| Crafting | About eight recipes: glass, lens, frame, tube, light source, immersion oil | Recipe values tuned by hand | Full materials property system |
| Microscopes | Tiers 1 to 3, working end to end | Tier 5 as a scripted showpiece view | Tiers 4 and 6 |
| Samples | About ten hand-authored discoveries in the Microdex | Atomic view drawn from a prepared image | Samples generated from a prompt |
| AI | Guide NPC grounded in the simulation's numbers | Prompt-to-world limited to three or four templates | Materials Project lookup, abTEM images, agent benchmark |
| Polish | Simple art, readable UI, one sound per action | Placeholder music | Tutorial and teacher mode |

## Technical architecture

The game runs in the browser, and a small backend handles the AI calls and the world cache.

*Figure: architecture.* A browser client (3D world and player; Build Bench and crafting; world generators and rules; 2D microscope view) sends the prompt to a backend service (planner LLM → validator → world cache), which returns the world spec to the client's generators. The backend also calls external services (LLM API, Materials Project, abTEM). (This figure is a drawing in the online doc.)

The validator (highlighted in the figure) is the only path from the model's output into the game, and the client plays cached worlds without waiting on the model.

- **Client:** TypeScript with Three.js for a 3D voxel-style world, and a plain 2D canvas for the microscope view.
- **Data:** recipes, samples and the object catalog are JSON files shared by the client and the validator.
- **Backend:** one small service, in Python or as serverless functions, that calls the LLM, validates specs and caches worlds.
- **External data (stretch):** the Materials Project for crystal structures and abTEM for simulated atomic images.

**Two views, one state.** The 3D world and the 2D microscope view both read the same plain TypeScript modules for inventory, recipes, microscope tier and discoveries, and neither renderer owns that data. The simulation module has no 3D dependency, so the eyepiece view can be built and tested before the world is finished. Aiming at an object and pressing a key switches from the world to the eyepiece.

The stack is a proposal; swap it for whatever the team already knows.

## Module design

The code is split into four owned modules around one shared core, so four people can build in parallel without editing the same files. Every module depends on the shared core, and none depends on another module.

*Figure: module dependencies.* Four modules (3D world, Microscope view, AI and backend, Content and UI) each depend on one shared core (src/shared). The shared core never imports Three.js or the DOM, and modules never import each other. (This figure is a drawing in the online doc.)

| Module | Folder | Owner | Exposes |
| --- | --- | --- | --- |
| Shared core | src/shared | Everyone; changes announced first | Types, game state, simulation rules, event bus |
| 3D world | src/world | Person A | Voxel scene, player, gathering, aiming at objects, opening the eyepiece |
| Microscope view | src/scope | Person B | 2D canvas view with zoom, focus and detail layers by tier; also owns the simulation rules and their tests |
| AI and backend | server | Person C | Planner, validator, world cache, guide endpoint |
| Content and UI | src/ui, data | Person D | Crafting and inventory screens, Microdex, guide panel, recipe, material and sample JSON |

**The shared contract** is written first, by all four together:

- Types and JSON schemas for recipes, materials, samples, game state and the world spec live in src/shared and are checked by a test.
- A small event layer connects the modules: openEyepiece(sampleId), closeEyepiece(), itemCrafted(itemId) and discoveryUnlocked(id).
- src/shared imports nothing from Three.js or the DOM, so the simulation runs in tests and in the backend.
- A change to a shared type is announced to the team before it is merged.

**Stubs keep everyone unblocked.** The world starts as a flat plane with one cube, the eyepiece as a blank canvas that shows a fake sample, the guide as canned replies, and the planner as a fixed world spec. Each owner swaps in the real version on their own branch.

## Team roles and build timeline

The team has four people and the build window is not fixed yet (see open questions), so the plan is written as ordered phases with a gate after each. Phase lengths get set once the window is known.

| Role | Owns |
| --- | --- |
| Person A: 3D world | Three.js scene, player controls, gathering, aiming at objects, the key that opens the eyepiece |
| Person B: microscope view and simulation | 2D canvas view, formulas and their tests, the "hit a wall" logic |
| Person C: AI and backend | Planner prompt, JSON schema, validator, world cache, guide NPC |
| Person D: content and UI | Recipes, materials, samples, Microdex, crafting UI, README, demo script, playtests |

1. **Setup.** Pick the engine, create the repo, agree the data schemas. Gate: a player can walk around a blank world.
2. **Vertical slice.** Gather, craft and build a tier 1 microscope, and see one new thing. Gate: the full loop works once.
3. **Content.** Tiers 2 and 3, the Microdex and the physics rules. Gate: a playtester climbs three tiers.
4. **AI layer.** Guide NPC, then the prompt-to-world templates. Gate: a typed prompt produces a playable world.
5. **Polish and demo.** Tier 5 showpiece, bug fixes, rehearsed demo. Gate: a clean five-minute run.

## Risks and mitigations

Scope is the biggest risk, because a crafting system, a world and an AI layer is a lot for one event. The 3D world is the part to watch: keep it to flat-colored cubes and one small map, and if it falls behind, swap it for 2D tiles, since the shared state and the microscope view do not depend on it.

| Risk | Mitigation |
| --- | --- |
| Scope grows past the build window | Ship tiers 1 to 3 and a scripted tier 5; finish one loop before adding content |
| The game teaches something wrong | Keep rules simple, label simplifications (such as the non-relativistic electron wavelength), and have a microscopy expert review the numbers |
| Microscope views are not impressive | Build the view renderer early; use blur and zoom effects on procedural scenes and real or simulated images for showpieces |
| LLM output is invalid or unphysical | Fixed catalog, schema validator, one retry, and a default fallback world |
| Model latency or an outage during the demo | Generate worlds ahead of time, cache them, and pre-generate the demo prompts |
| The game is not fun | Playtest with someone outside the team as soon as the first loop works |
| Data or image licensing | Use open datasets and credit them in the game and README |

## Demo script and judging pitch

The demo shows the whole idea in about five minutes: a player builds a tool and the world gets smaller.

1. **Start with a blurry world.** The player holds nothing and sees a leaf and a pond from far away.
2. **Build a hand lens.** Gather sand, smelt glass, craft the lens, then aim at a leaf and press a key to look through it and see leaf veins.
3. **Hit the wall, then upgrade.** The compound microscope shows cells, and the guide explains why more magnification alone stopped helping.
4. **Type a prompt.** The presenter enters a sentence and a new world appears with its own hidden scales.
5. **Show the electron showpiece.** The tier 5 view reveals crystal structure, and the guide explains why electrons see smaller than light.

For judges, the pitch has four points:

- **Fit.** The game applies LLMs and multimodal models to materials science and physics education, the hackathon's stated focus.
- **Grounded.** Worlds come from structured specs and real structure data, not free-form model output.
- **Educational by design.** Players learn by building the instrument, and every upgrade has a physical reason.
- **Extensible.** Recipes, samples and object types are data files, and the agent benchmark could feed the collaborative papers the organizers describe.

## Open questions

- [ ] Is the 3D world worth its cost? The plan uses a 3D voxel-style world with a 2D microscope view; if it falls behind, switch the world to 2D tiles.
- [ ] Browser game, or a mod or engine such as Luanti?
- [ ] Who takes each of the four roles: 3D world, microscope view and simulation, AI and backend, content and UI?
- [ ] How long is the build window?
- [ ] Which age group do we target first: middle school, high school or early undergraduate?
- [ ] Which LLM and API will power the planner and the guide?
- [ ] What are the hackathon's tracks, judging criteria and submission format? The event page does not list them.
