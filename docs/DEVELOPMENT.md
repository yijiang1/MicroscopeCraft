# Developing MicroscopeCraft

How to run, how the code fits together, and how to contribute. The design is in [DESIGN.md](DESIGN.md); how to play is in [PLAYING.md](PLAYING.md).

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
src/workbench/     the workbench: build the compound microscope by hand (prototype)  mountWorkbench(el, ctx)
src/main.ts        loads data, creates state, mounts every module (the only file that imports them all)
```

Every module depends on `src/shared`; **no module imports another** (ESLint enforces it). Modules talk through:

- **State**: `ctx.state` is read-only for renderers. Change it only with the actions in `src/shared/state.ts` (`gather`, `craft`, `assemble`, `discover`, `completeQuest`, `recordScore`, `visit`, `setSite`, `setAlign`). Every action re-checks the achievements.
- **Events** (`src/shared/events.ts`): `openEyepiece({sampleId})`, `closeEyepiece`, `itemGathered`, `itemCrafted`, `discoveryUnlocked`, `tierChanged`, `zoomChanged`, `scopeChanged`, `trackItem`, `trackTarget`, `talkTo`, `questCompleted`, `achievementUnlocked`, `minigameScored`, `areaVisited`, `guideAsked`, `guideReplied`, `openWorkbench`, `closeWorkbench`.
- **Steps and modes**: a microscope recipe lists `steps` (label, magnification, NA, imaging `mode`, optionally an add-on it `requires`, and a per-step lens blur or voltage). `setZoom(ctx, i)` picks one; `state.scope` always holds the current step. A microscope built by hand at the workbench (`"assembly": "compound"` in its recipe) takes its steps from the build instead, one per objective: `state.builds` keeps the build and `compileBuild()` in `src/shared/sim/assembly.ts` turns it into steps.
- **Microdex**: `microdex(data, state)` (`src/shared/microdex.ts`) groups one card per feature by area. The eyepiece keeps the best picture of each discovery in `state.snapshots` (saved under their own storage key, only when one changes, since they are most of the save). A sample is a `data/samples.json` entry; `npm test` checks every blurb is two sentences and every feature is reachable by some instrument step.
- **Sim**: `visibility(feature, scope, stain)` in `src/shared/sim/optics.ts` returns whether a feature shows and why not (`other-mode`, `unresolved`, `empty-magnification`, `too-small-to-see`, `low-contrast`). `explainWall()` in `src/shared/sim/walls.ts` turns that into the plain-language "hit a wall" message. The scope banner and the guide both use it.
- **Achievements and requests**: one rule language (`Condition` in `schema.ts`, checked by `src/shared/achievements.ts`) drives both the achievements and what each scientist asks for. Every request is an achievement too.

Inside `src/world`: `world.ts` wires the scene, input, aiming and gathering together and runs the frame loop; `kinds.ts` says what each kind of object is (what E gathers and F shows, its radius, its model); `placements.ts` says where each one stands; `models.ts`, `campus.ts`, `decor.ts`, `terrain.ts`, `npc.ts` and `player.ts` build the 3D models; `hud.ts` is the text over the view and the sample picker; `navigation.ts` is collision, areas and the compass and arrow texts, as plain geometry with tests.

Performance: each model's parts are merged into one mesh per material (`mergeByMaterial`), the world loop runs at 60 fps at most (20 fps while the mouse is free), and shadows are redrawn only when something in them moved. Check a change with `__world.renderer.info.render.calls` in the dev console.

Units: lengths are micrometres (µm) everywhere, spelled in field names (`sizeUm`, `dLensUm`).
Simplified physics is labelled in comments next to the formula.

## Contributing

**Who owns what**

| Folder | Owner |
| --- | --- |
| `src/world` | Person A: 3D world and player |
| `src/scope`, `src/shared/sim` | Person B: microscope view and simulation |
| `server`, `src/guide`, `src/shared/worldspec.ts` | Person C: AI and backend |
| `src/ui`, `data/*.json` content | Person D: content and UI |
| `src/workbench`, `src/shared/sim/assembly.ts` | Workbench prototype (see [DESIGN.md](DESIGN.md)) |
| `src/shared` (rest), `src/main.ts` | Everyone; see below |

**Branches**: `<area>/<short-description>`, with area one of `world`, `scope`, `ai`, `ui`, `shared`, `docs`. Example: `scope/blur-by-deff`. Branch from `main`.

**Small PRs**: one thing per PR, aim for under 300 changed lines, merge within a day. Run `npm run check` first. Commit messages say what and why in one line.

**Don't change `src/shared` types (`schema.ts`, `events.ts`, the `GameContext`/state API) without telling the team.** Post in the team chat first, then open a PR that changes only the contract (plus the fixes other modules need to keep compiling). Adding an optional field or a new JSON entry is fine without a heads-up; renaming, removing or tightening anything is not.

**Data-driven**: new recipe, material, sample, scientist, request or achievement = one JSON entry in `data/`. `npm test` validates it against the schema and checks cross-references (an unknown discovery, item, mini-game or area in a condition fails). A new object in the world = one entry in `src/world/kinds.ts` (with a model builder in `models.ts` if none fits) plus its spot in `placements.ts`; `npm test` checks it gathers a real item or shows a real sample and stands on dry land, indoors only if marked so.

**The LLM never generates pixels or free-form content.** It outputs a world-spec JSON that `validateWorldSpec` accepts or rejects.

## The Invisible Specimen minigame

Run `npm run dev`, then open `/minigames/invisible-specimen/index.html` on the local server. The standalone game includes ten assignments, optical and electron imaging, magnification, specimen-locked zoom, and a saved discovery journal. You can also open its HTML file directly without a server.

See [integration notes](../public/minigames/invisible-specimen/INTEGRATION.txt) for the completion event and iframe setup. Building entry points and inventory rewards are not wired into the main world yet.
