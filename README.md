# MicroscopeCraft

A Minecraft-style browser game: gather materials, craft parts, build microscopes (hand lens → compound → high-quality optics), and look through them to see smaller worlds. Game design: [DESIGN.md](DESIGN.md) (source of truth).

TypeScript + Vite. Three.js for the 3D world, a plain 2D canvas for the microscope view.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 (click the world, WASD, E gather, F eyepiece, M Microdex)
npm run check    # typecheck + lint + tests; must pass before every PR
```

Sounds are synthesised in the browser (`src/ui/sound.ts`); the side panel has a mute button.

Other scripts: `npm run build`, `npm test`, `npm run typecheck`, `npm run lint`.
In dev, `window.game` exposes the game context (`game.state`, `game.bus`) for poking from the console.

## How it fits together

```
data/*.json        recipes, materials, samples, object catalog, fixed world spec (add an entry = add content)
src/shared/        pure TS, no Three.js, no DOM: schema (Zod), state + actions, event bus, sim formulas, world-spec validator
src/world/         3D world            (Person A)  mountWorld(el, ctx)
src/scope/         2D eyepiece         (Person B)  mountScope(el, ctx)
src/ui/            crafting, Microdex  (Person D)  mountUI(el, ctx)
src/guide/         guide client        (Person C)  mountGuide(ctx)
server/            LLM backend         (Person C)  added in the AI phase
src/main.ts        loads data, creates state, mounts every module (the only file that imports them all)
```

Every module depends on `src/shared`; **no module imports another** (ESLint enforces it). Modules talk through:

- **State**: `ctx.state` is read-only for renderers. Change it only with the actions in `src/shared/state.ts` (`gather`, `craft`, `discover`).
- **Events** (`src/shared/events.ts`): `openEyepiece({sampleId})`, `closeEyepiece`, `itemGathered`, `itemCrafted`, `discoveryUnlocked`, `tierChanged`, `guideAsked`, `guideReplied`.
- **Zoom**: a microscope recipe lists `steps` (label, magnification, NA). `setZoom(ctx, i)` picks one; `state.scope` always holds the current step.
- **Microdex**: `microdex(data, state)` (`src/shared/microdex.ts`) groups one card per feature by biome. The eyepiece keeps the best picture of each discovery in `state.snapshots`. A sample is a `data/samples.json` entry; `npm test` checks every blurb is two sentences and every feature is reachable by some microscope.
- **Sim**: `visibility(feature, scope)` in `src/shared/sim/optics.ts` returns whether a feature shows and the reason it does not (`unresolved`, `empty-magnification`, `too-small-to-see`, `low-contrast`). `explainWall()` in `src/shared/sim/walls.ts` turns that into the plain-language "hit a wall" message. The scope banner and the guide both use it.

Each module runs from day one. The world is an open landscape with procedural 3D models (see `src/world`), the eyepiece blurs a procedural specimen by the scope's effective resolution, the guide gives canned replies keyed on the sim's reason code, and `data/worlds/default.json` is the fixed world spec. Replace internals inside your own folder; keep the exported `mount*` signature.

Units: lengths are micrometres (µm) everywhere, spelled in field names (`sizeUm`, `dLensUm`).
Simplified physics is labelled in comments next to the formula.

## Controls

| Key | Action |
| --- | --- |
| Click, WASD, mouse | Look and walk (Esc frees the mouse) |
| Shift, Space | Run, jump |
| V | Switch first/third-person camera to see your blue-shirted explorer |
| E | Gather the item you are aiming at (a ring and a prompt show what it is) |
| C | Craft the next ready step of your goal (no mouse needed) |
| Tab | Menu: inventory, all recipes, guide, sound (G jumps straight to the guide box) |
| F | Look at the aimed sample through your newest instrument (F or Esc to leave) |
| 1, 2, 3… | In the eyepiece: switch to another microscope you own, to compare (or click its button) |
| I | Show or hide the inventory box (bottom right: materials, parts, microscopes) |
| Wheel or slider | Focus (compound microscope and up) |
| M | Microdex |
| K | Restock every raw material, skipping the identifications (only when the URL ends in `?demo`) |

## Finding your way

The goal card at the top right is always on screen. Its bold line is the one thing to do right now ("Gather 2 Beach sand", "Press C to craft Glass", "Look (F) at a Grey rock with your Hand lens"). Press the ▸ button to see the whole checklist for the next microscope: what to identify, what to gather and where, and the crafts in order, with ✓ for done. Everything works from the keyboard: **E** gathers, **C** crafts the next ready step, **F** looks, and you never need to free the mouse.

The nearest source of the material you need is shown by an **arrow and distance** at the top of the screen, and a small floating marker over it once you are within about 30 m. Click a row in the checklist to track another material. Glass and lenses are crafted, not found.

**Some materials must be identified first.** Copper, plant oil and tungsten are only recognisable through a microscope: until you have looked at them (F) and spotted what is inside, the rocks are plain grey, the seeds are just seeds, and E is locked. Each is found with the *previous* microscope, so every upgrade needs something the last one discovered:

| To build | You need | Identify it with | Look (F) at |
| --- | --- | --- | --- |
| Compound microscope | Copper (for the lamp) | Hand lens: copper veins | A plain grey rock in the highlands |
| High-quality microscope | Plant oil (immersion oil) | Compound microscope: oil droplets | A sunflower seed |
| Electron microscope | Tungsten (the filament) | High-quality microscope: tungsten grains | A heavy grey rock at the far end of the highlands |

Ask the guide with **G**: "where do I find quartz sand?", "how do I make glass?" or "what next?".

## The world

A walkable landscape, about 150 m across, in four areas. Everything is procedural: terrain, models and textures are generated in code, with no asset files.

| Where | What is there |
| --- | --- |
| Meadow (spawn, centre) | Leafy plants, flowers, a butterfly wing on a stone, sunflowers (plant oil), grass and oaks |
| Pond (west) | Water to look at, sand mounds on the eastern shore |
| Highlands, the mine (east) | Iron, copper and tungsten rocks, quartz crystals, boulders |
| Pine grove (north-east) | Resin on tree stumps |
| Lab (far north) | A flat pad with lamp posts and a glowing crystal |

The top-left corner shows a compass heading and your x, z position.

## What to build (from `data/recipes.json`)

| Instrument | Raw materials in total | Steps |
| --- | --- | --- |
| Hand lens (tier 1) | 2 beach sand, 1 iron | Glass → Glass lens; Iron frame; Hand lens |
| Compound microscope (tier 2) | 6 beach sand, 2 iron, 1 copper (identify first) | 2 Glass lens, Iron tube, Focus knob, Lamp (copper + glass) |
| High-quality microscope (tier 3) | 6 quartz sand, 1 copper, 1 plant oil (identify first), plus the compound microscope | 3 Quartz glass → 2 Precision lens; Condenser; Immersion oil |
| Electron microscope (tier 5) | 1 tungsten (identify first), 2 resin, 4 iron, 4 copper | Tungsten filament; Vacuum seal → Vacuum chamber; 2 Magnetic lens |

## Demo script (about 5 minutes)

Open `http://localhost:5173/?demo`. The LLM prompt-to-world step of the full pitch is not built yet; see DESIGN.md.

1. **Blurry world (0:00).** Walk to a leafy plant (a few steps north-west of the spawn), aim at it and press F with no instrument. The side veins are fuzzy and the fine veins are gone. Say: "Everything we can see is limited by the eye." Press F or Esc to leave.
2. **Build a hand lens (0:45).** Follow the goal card: gather 2 sand mounds (by the pond, west) and 1 iron rock (the highlands, east) with E, then press C four times. Look at the leaf again: the vein network is sharp and the Microdex toast appears. The banner says the hand lens resolves about 30 µm, so the leaf cells are still blurred.
3. **Discover something to unlock the next tier (1:45).** The goal card now says to identify copper. Walk east to a plain grey rock and press F: the hand lens shows green copper veins, the rocks turn into copper ore and E works. Say: "A better instrument needs something only the last one could see." Press K to restock the rest, press C through the compound microscope's crafts, then look at the pond water at 100× (alga threads) and 800× (the banner: more magnification only makes a bigger blur). Ask the guide "why is it blurry?" (press G).
4. **High-quality optics (3:00).** Look at a sunflower seed with the compound microscope to spot the oil droplets (this unlocks plant oil), then craft the high-quality microscope. Look at the pond at 1000× with oil immersion: bacteria rods appear. Virus particles stay blurred; the banner explains the diffraction limit and points to electrons.
5. **Electron showpiece (3:45).** Look at a heavy grey rock with the high-quality microscope to spot tungsten grains, then craft the electron microscope. Look at the pond at 150,000×: a virus, then watch the beam damage warning as the dose builds (zoom out or close the eyepiece to reset). Walk far north to the lab pad and look at the glowing crystal at 500,000×: grains, then 2,000,000×: the atomic lattice. Press M to show the Microdex.

Pitch points: the instrument is earned by building it; every upgrade has a numeric reason (shown in the HUD: resolution, NA, dose); all content is JSON in `data/`.

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

**Data-driven**: new recipe, material, sample or catalog type = one JSON entry in `data/`. `npm test` validates it against the schema and checks cross-references.

**The LLM never generates pixels or free-form content.** It outputs a world-spec JSON that `validateWorldSpec` accepts or rejects.
