# MicroscopeCraft

A Minecraft-style browser game: gather materials, craft parts, build microscopes (hand lens → compound → high-quality optics), and look through them to see smaller worlds. Game design: [DESIGN.md](DESIGN.md) (source of truth).

TypeScript + Vite. Three.js for the 3D world, a plain 2D canvas for the microscope view.

## Run

```bash
npm install
npm run dev      # http://localhost:5173 (click the world, WASD, E gather, F eyepiece, M Microdex)
npm run check    # typecheck + lint + tests; must pass before every PR
```

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

Each module runs from day one. The world has gatherable cubes and a leaf, the eyepiece blurs a procedural specimen by the scope's effective resolution, the guide gives canned replies keyed on the sim's reason code, and `data/worlds/default.json` is the fixed world spec. Replace internals inside your own folder; keep the exported `mount*` signature.

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
| `src/shared` (rest), `src/main.ts` | Everyone; see below |

**Branches**: `<area>/<short-description>`, with area one of `world`, `scope`, `ai`, `ui`, `shared`, `docs`. Example: `scope/blur-by-deff`. Branch from `main`.

**Small PRs**: one thing per PR, aim for under 300 changed lines, merge within a day. Run `npm run check` first. Commit messages say what and why in one line.

**Don't change `src/shared` types (`schema.ts`, `events.ts`, the `GameContext`/state API) without telling the team.** Post in the team chat first, then open a PR that changes only the contract (plus the fixes other modules need to keep compiling). Adding an optional field or a new JSON entry is fine without a heads-up; renaming, removing or tightening anything is not.

**Data-driven**: new recipe, material, sample or catalog type = one JSON entry in `data/`. `npm test` validates it against the schema and checks cross-references.

**The LLM never generates pixels or free-form content.** It outputs a world-spec JSON that `validateWorldSpec` accepts or rejects.
