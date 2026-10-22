# Playing MicroscopeCraft

A guide to the game: controls, where things are, what to build, and every system in it. For how the code is organised and how to contribute, see [DEVELOPMENT.md](DEVELOPMENT.md); for the design, [DESIGN.md](DESIGN.md).

## Controls

| Key | Action |
| --- | --- |
| Click, WASD, mouse | Look and walk (Esc frees the mouse) |
| Shift, Space | Run, jump |
| V | Switch between the over-the-shoulder view (the default) and first-person |
| E | Gather the item you are aiming at, or talk to the scientist you are aiming at (their dialog has a chat box: ask them about their own field, answered by Google Gemini, OpenAI or Anthropic Claude once you pick one and add your own API key under Tab → Settings; it is kept only in your browser) |
| F | Look at the aimed sample through your newest portable instrument (F or Esc to leave). At a cabinet or table, pick a sample first (1–9). Once you own a fixed instrument this also takes a bit of the sample along; F at the electron microscope in the science lab, or at the beamline desk in Wilson Lab, puts one in |
| C | Craft the next ready step of your goal (no mouse needed). In advanced mode, for the compound microscope it opens the workbench |
| Shift+B | Workbench (advanced mode, Tab → Settings → Mode): build the compound microscope by hand. Grind the lenses, put the parts together, focus it, style it. Without the parts it opens in practice mode |
| 1, 2, 3… | In the eyepiece: switch to another instrument you own, to compare (or click its button) |
| Wheel or slider | Focus (light microscopes) |
| T | Tech tree: every part, with add-ons shown by dashed links |
| J | Journal: achievements with progress, and every scientist's requests with Track buttons |
| M | Microdex (click a card you have not found to track its sample) |
| I | Show or hide the inventory box |
| Tab | Menu: tech tree, workbench, Microdex, journal, settings (sound, AI chat provider and API key), save and restart |
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


## The world

A university campus about 300 m across (north is up the quad, -z), laid out after Cornell's. Everything is procedural: terrain, buildings, models and textures are generated in code, with no asset files. Every hall has a door and a ground-floor room (bookshelves, a lab bench with glassware, or a blackboard), and many scientists work inside. The clock shows your computer's time, and the tower bells ring it: a chime each quarter hour, and the hour struck on the big bell, louder the closer you are.

| Where | What is there |
| --- | --- |
| Quad (centre) | Lawn, halls, bronze statues of Leeuwenhoek and Ruska, a spare bronze chime bell beside the clock tower. Leafy plants, flowers with a honeybee, a butterfly wing, sunflowers, a picnic table (salt, notebook paper). Inside the halls: Röntgen in the domed hall, Zernike and Gram in the west row, Abbe behind the portico, Robert Hooke in the library by the tower, Cajal in the south library |
| Lake (north-east, where you start) | Lake water, mud and an algae mat at the edge, a duck feather, sand. Antonie van Leeuwenhoek waits on the shore |
| Gorge (north) | Iron, galena, quartz and fluorite on the rim; down by the creek, pale willemite rocks, dark monazite sand and a slab of fossil shale. An iron railing runs along both rims and the creek itself is too deep to wade; two trails lead down the walls to a ledge along the water. A stone dam holds the lake at the lip of the falls. Just below the falls, a suspension footbridge (after Cornell's Fall Creek suspension bridge) crosses to two residence halls on the north side |
| Art museum (top of the slope, by the gorge) | After I. M. Pei's Johnson Museum: a concrete gallery under two towers and a cantilevered top floor, with an open sculpture court between. Inside, at their real sizes, procedural copies of The Night Watch, A Sunday on La Grande Jatte, The Starry Night, Girl with a Pearl Earring and The Great Wave. Look closer (F): brushstrokes and craquelure by eye, pigment grains (natural and artificial ultramarine, zinc yellow, Prussian blue) under the microscopes, and at the beamline the canvas weave in tomography, X-ray maps of cobalt, lead, iron and chromium, and the lead formate found in Rembrandt's paint |
| West slope (after Libe Slope) and pine grove | An open lawn falling 10 m from the clock tower, with benches along the top looking west over a big lake (after Cayuga). At its foot, the Gothic west campus halls and their tower. Copper and iron rocks, heavy tungsten rocks and beryl crystals at the foot, mica schist; among the pines, resin stumps, a pine branch, a fallen oak log, mushrooms, moss, lichen, a spider web, ferns and an old bone. |
| Greenhouse (south of the quad) | Onion, potato, orchid, stinging nettle and cotton. Robert Brown works here |
| Science building (south-east) | The glass-walled lab: stains on the shelf by the door, a slide cabinet and a materials cabinet, the electron microscope bay (each part you craft appears in place). Ruska, June Almeida and Albert Crewe work here. Next door to the east, the chemistry building (after Baker Lab), where Dorothy Hodgkin works |
| Wilson Lab (east) | The CHESS hall beside the CESR ring: the beamline from the ring wall to the hutch, a sample rack, and Batterman and Bragg |
| Athletic fields (far east) | Over the storage ring's tunnel: a gridiron with goalposts and stands, a practice field, and the field house (after Barton Hall) with a trophy case. White clover with root nodules, a roll of turf with crumb rubber, dandelions past the far end. Martinus Beijerinck works here |
| North campus (across the suspension bridge) | A desk with optical discs and a phone, and a dusty bed, in the east residence hall's ground-floor room; north of it, the observatory, whose gutter dust holds micrometeorites |
| North woods (west of the residence halls) | Tall grass with deer ticks, a slime mould on a fallen log, an owl pellet on a stump. Willy Burgdorfer works here. Down the slope to the west, cattails where the creek meets Cayuga |
| Orchard and apiary (north-east, beyond the lake) | Apple trees, beehives, windfall apples with fruit flies, a hornet nest at the far end |
| Farm, dairy and cornfield (south-east, and south of the south hall) | The Dairy Bar's stand (ice cream and yogurt), dairy cows, sheep, and a field of variegated corn. Louis Pasteur at the dairy, Barbara McClintock in the corn |
| West campus and the Cayuga shore (foot of the west slope) | A ruby and cobalt window panel in the Gothic hall, a heap of road salt mined under the lake, a dock with a plankton net. Richard Zsigmondy works by the Gothic hall |
| Fossil quarry (south-west, below the west slope) | Crinoid limestone ledges, a trilobite slab, an acid sieve of conodonts, horn corals. Christian Pander works here |
| Engineering quad (south, down the path past the greenhouse) | Halls after Bard, Snee, Upson and Phillips. The geology hall's rock garden: granite, basalt, obsidian, marble, chalk, pyrite, malachite, lodestone and garnet schist. A materials yard: concrete blocks, a rusty steel beam, bricks, a solar panel and a catalytic converter. A glass atrium (after Duffield) with display cases of quantum dots, carbon nanotubes, a zeolite, a metal-organic framework, a superconductor pellet and a blue LED. Henry Clifton Sorby works in the geology hall, Rosalind Franklin in the materials hall, Mildred Dresselhaus in the atrium |

**Fixed instruments stay where they are built**: the electron microscopes in the science lab, the beamline in Wilson Lab. Look (F) at a sample anywhere and you take a bit along (up to 8); the HUD shows where to carry them. Light microscopes work anywhere.

## What to build (from `data/recipes.json`)

| Instrument | Raw materials in total | Components |
| --- | --- | --- |
| Hand lens (tier 1) | 2 beach sand, 1 iron | Glass lens, iron frame |
| Compound microscope (tier 2) | 6 beach sand, 2 iron, 1 copper | 2 glass lenses, iron tube, focus knob, lamp. Put together by hand at the workbench; each objective after the first takes one more glass lens |
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

## Mystery samples: The unlabelled alloy

Talk to **W. L. Bragg in Wilson Lab** (`E`) and choose **Accept mission · The unlabelled alloy**. He gives you a prepared unknown powder in your sample bag. The journal (`J`) can track Bragg, and **Tab → Mission notebook** reviews the investigation; the menu cannot issue a sample or run an experiment.

Build a **TEM or STEM** and carry the unknown to the electron microscope in the science lab, or use your built **CHESS beamline** in Wilson Lab. Press **F at the instrument**, pick **Bragg’s unknown powder**, and switch to **Electron diffraction** or **X-ray diffraction**. The eyepiece shows the unknown’s rings and a panel for making a prediction and recording a survey or precision measurement. The instrument must be owned, at its station, in diffraction mode, with the mission sample loaded.

Identify copper, nickel, or a model 50:50 atomic Cu–Ni alloy within eight beam-time credits. Compare the measured (111)/(200) spacings with the notebook’s reference predictions and select evidence to cite. Return to Bragg, open **Present evidence**, and submit a supported conclusion to complete his journal request and earn its achievement. Unsupported guesses can be revised. Bragg can issue another sample after completion.

The notebook, predictions, instrument provenance, and results are part of the main game save. The mission sample is protected from bag overflow. A completed case offers a downloadable JSON lab report. Guidance is deterministic; no API key is needed. Earlier standalone prototype evidence does not count toward this mission.

This is an explicitly simplified, closed-set simulation: FCC plane spacings, bounded synthetic error, and an approximate linear alloy lattice parameter. It does not identify arbitrary real materials. Sources and assumptions are available inside the notebook. Mission logic is in `src/shared/mystery.ts` and `src/shared/mysteryActions.ts`, acquisition in `src/scope/mystery.ts`, and the notebook in `src/ui/mystery.ts`.

## Scientists and achievements

Twenty-five scientists stand around campus: Leeuwenhoek, Hooke, Robert Brown, Abbe, Zernike, Cajal, Gram, Ruska, June Almeida, Albert Crewe, Röntgen, W. L. Bragg, Rosalind Franklin, Dorothy Hodgkin, Boris Batterman (CHESS's first director), Henry Clifton Sorby (rocks and steel, in the geology hall), Mildred Dresselhaus (carbon nanotubes, in the atrium), Hans Bethe and Earl Kirkland; and out in the corners, Richard Zsigmondy (the ultramicroscope), Martinus Beijerinck (root-nodule bacteria), Barbara McClintock (jumping genes), Louis Pasteur (fermentation), Willy Burgdorfer (the Lyme spirochete) and Christian Pander (conodonts). Press E to talk: each has two to five requests (77 in all), mostly "show me what you found", and every request done is an achievement. A gold **!** over a scientist means you can show them something now; **?** means they are still waiting. With 80 more achievements for discoveries, instruments, areas, mini-games and milestones, there are 157.

The Microdex holds 378 discoveries in 122 samples across sixteen areas. Every corner of the map has something to look at: `npm test` checks that no walkable spot is more than 40 m from a sample or a scientist.

## Demo script (about 10 minutes)

Open `http://localhost:5173/?demo`. The LLM prompt-to-world step of the full pitch is not built yet; see [DESIGN.md](DESIGN.md).

1. **Blurry world (0:00).** Turn left to the leafy plants a few steps west of where you start, aim at one and press F with no instrument. The fine veins are gone. In the mud at the lake's edge your bare eyes can just make out a Paramecium. Say: "Everything we can see is limited by the eye." Talk to Leeuwenhoek (E) on the shore: he asks to see it.
2. **Build a hand lens (0:45).** Follow the goal card: gather 2 sand mounds and 1 iron rock with E, then press C four times. Look at the leaf again: the vein network is sharp and the Microdex toast appears.
3. **Discover to unlock (1:45).** The goal card says to identify copper. Look at a plain grey rock on the west slope with the hand lens: green copper veins, the rocks turn into copper ore. Press K to restock, press C through the compound microscope, then look at lake water at 800× (the banner: empty magnification).
4. **Light to its limit (3:00).** Spot oil in a sunflower seed, build the high-quality microscope and resolve bacteria at 1000× with oil. In the lab, open the diatom test slide and align the condenser (Köhler) until Amphipleura's 0.25 µm striae resolve. Show Abbe.
5. **Electrons and X-rays (3:45).** With K and C, build up to the TEM, STEM and beamline (fluorite, willemite, monazite and beryl must each be identified on the way). Align the TEM until gold's 0.235 nm lattice planes resolve, flatten the Ronchigram until single silicon atoms in graphene shine, reconstruct MoS₂ by ptychography (the 0.39 Å record), and in Wilson Lab tune the undulator to map cobalt in vitamin B12 for Dorothy Hodgkin. Press J to show the journal.

Pitch points: the instrument is earned by building it, part by part; every upgrade has a numeric reason (shown in the HUD: resolution, NA, dose, flux); the mini-games are the real alignment procedures; all content is JSON in `data/`.

## More to do on campus

### New visitors and footsteps

Hans Bethe stands outside the science building at (20, 20); Earl Kirkland is nearby at (20, 32). Press **E** to talk, or track them from the scientists journal. Each has two requests. Their dialogue and block-style appearances are fictionalized.

Walking and running play quiet, synthesized footsteps, with grass, stone, and water variations. Steps stop in the air, when movement stops, and when controls are unlocked. Use **Tab → Sound** to mute them along with the other game sounds.

Scientists stroll within 12 metres of their home locations, avoiding walls, water, and obstacles. Nearby pairs pause for alternating science conversations in overhead speech bubbles; these are fictional scripted exchanges, not historical quotations. Walk close to a scientist to keep them still for interaction. The bottom-left minimap tracks their live positions.

### Campus rewards and ScopeCraft Store

- Press **E** at the **Field Lab** console inside the Science Building (28, 17) for The Invisible Specimen, Köhler illumination, Gram staining, stain timing, TEM alignment, aberration correction and ptychography. The **Wilson Lab** console (54, 2) offers beam tuning and tomography. The Tab menu also provides direct activity shortcuts.
- Each new 20% score milestone pays 10 coins; reaching 80% pays one voucher. Rewards are saved per mini-game, so improving a score pays the difference and repeated submissions do not duplicate payouts. Each of Invisible Specimen's ten successfully photographed assignments is a separate completed challenge (50 coins and one voucher).
- Visit **ScopeCraft Store** in the giant light-microscope building between the quads (counter at -12, 33; entrance on its south side), or open **Tab → ScopeCraft Store & wardrobe**. Buy readable scientist biographies, original microscopy learning notes, clothing, a backpack, and a miniature microscope souvenir using coins or vouchers. Equip cosmetics in the shop and use **V** to see them in third person. Outfits, purchases and balances persist in the save.
- NPC dialogs now offer **Receive sample** and **View sample**. Gifts relate to their research requests, use the normal eight-slot sample bag, and can be collected again if misplaced. Receiving a sample does not automatically identify its features.
- Ambient conversations use compact, softly shaded overhead bubbles with speaker labels. Characters pause while talking; each utterance holds a stable anchor. Nearby overlapping bubbles are suppressed, and opaque building walls hide conversations. Text is rendered as an overlay so it cannot intersect ceiling geometry. These ambient conversations remain scripted; player-to-NPC AI chat is a separate optional feature.

Store inventory cards show illustrated item previews. Click a preview to enlarge it before buying. ScopeCraft Store has a walk-in glass shop in the microscope base, a specimen stage, curved support arm, focusing wheels, revolving objectives and an angled eyepiece.

### Clock tower lookout and music

The glass elevator on the east side of the clock tower takes you to a railed terrace 30 metres above campus. Walk up to it and press **E** to ride; press **E** near the cabin upstairs to return. You can look around during the ride.

Two original synthesized background themes accompany campus walks and lab visits. After your first click or key enables audio, the tower plays a bell arrangement of the traditional **Oh Tannenbaum** every five minutes, with distance attenuation. The existing **Sound** toggle mutes all music and effects immediately. No audio downloads or API keys are needed.

The tower elevator, support rails and lookout terrace use faint blue transparent glass. The ScopeCraft Store also displays the **Micro Roadster**, a red classic convertible priced at **600 coins / 24 vouchers**. Try it free for **30 seconds**, then return automatically to the store. Use **W/S** to accelerate or reverse, **A/D** to steer, and **E** to return early. Purchased cars unlock untimed drives.

### Fishing and fish specimens

Claim the **Field fishing rod** for **0 coins** in ScopeCraft Store. Near water at shoreline height, click **Fish** or press **R**. Cast, wait for a bite, then reel with the marker in the green zone: three successful reels land a catch, while three misses let it escape. Perch, bass, salmon, sunfish, trout and carp can be caught; your collection is saved. Select **Prepare scale sample** to consume a catch and add its specimen to the sample bag, then **View sample** to inspect it. The samples use schematic scale surfaces, ridges and fine prepared fibres at different magnifications.

Press **U** to open the full campus map; press **U** or **Esc** to close it. Fishing uses an avatar-held rod with animated casting, reeling, a line and bobber, and a catch reveal. Fish wander randomly within the water.

### Field binoculars

Buy **Field binoculars** for **75 coins** in ScopeCraft Store. Once acquired, they appear in the bottom-right inventory with **=** to raise/lower the view. Scroll to adjust magnification from **2× to 8×**. **Esc** releases the mouse but keeps binoculars raised; click the world to resume looking around. Only **=** lowers them. The shortcut is hidden until purchase. The advanced microscope workbench uses **Shift+B** (or its menu button).

Microdex (**M**) includes a fish collection for all six species. Catches stay recorded after preparing their scales; prepare and view samples directly from the collection, and track microscopic discoveries separately.

### Seasons and snow

Spring → summer → autumn → winter, **6 real-time minutes per season** (24-minute cycle). The season and countdown appear at the upper left. The cycle starts in spring and is saved, so time away also advances it. Trees and lawns change color; winter adds snow cover and snowfall without adding overlapping ground surfaces.

In winter, find snow on outdoor picnic tables, bench and chair seats, tree crowns, and snowbanks throughout campus. **E** collects snow and a chilled slide; **F** examines it. At the picnic table, use its ordinary **F** sample picker to choose snow crystals. The slide stays available after winter, with six-armed crystals and hexagonal plates to discover in Microdex. These are idealized educational drawings; see [NOAA's explanation of snow-crystal symmetry](https://www.noaa.gov/stories/how-do-snowflakes-form-science-behind-snow).

### Store fitting room and free look

The ScopeCraft Store has clothing rails, field backpacks, bookshelves and science souvenir displays. Enter the fitting booth at the back right and press **E**, or choose **Fitting room** at the store counter. Rotate the character preview and equip your original blue shirt or purchased shirts, backpack and miniature microscope. Unpurchased items cannot be equipped.

Press **Z** to toggle free look while on foot. Mouse movement turns the camera without changing your character’s facing or WASD movement direction. Press Z again to restore mouse steering. Driving and fishing return to their normal camera controls.
