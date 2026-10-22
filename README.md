# MicroscopeCraft

**A Minecraft-style browser game about seeing smaller and smaller things.**

You start on a university campus with nothing but your own eyes. Gather sand, iron and copper, craft your first hand lens, and look again: the leaf in front of you suddenly has veins. Keep building, from a compound microscope to fluorescence, a transmission electron microscope, an aberration-corrected STEM and finally a synchrotron beamline modelled on Cornell's CHESS, until you can see single atoms.

Built for the [LLM Hackathon](https://llmhackathon.github.io/).

## What you do

- **Explore** a campus laid out after Cornell's: quads, a gorge with a waterfall, a lake, an art museum, labs, an orchard, a farm, a fossil quarry and the shore of a big lake.
- **Gather and craft** your way up seven tiers of instruments, part by part. Some materials can only be recognised under the previous instrument, so every upgrade is earned by looking.
- **Look closer** at more than a hundred samples, from pond water and pollen to paintings, meteorites, ruby glass and trilobite eyes. Each one hides new things at every scale, and the 376 discoveries fill your Microdex.
- **Meet the scientists** who made these discoveries, from Leeuwenhoek and Hooke to Ruska, Rosalind Franklin, Barbara McClintock and Dorothy Hodgkin. They ask to see what you find.
- **Run the instruments for real**: align a condenser, do a Gram stain, align a TEM, tune an aberration corrector, reconstruct a ptychography image, tune an undulator and centre a tomogram.
- **Side quests**: solve a mystery alloy by diffraction, fish, visit the campus store, ride the clock tower's lookout, take a roadster for a spin.

## Real science

Everything you see follows real physics, with simplifications labelled in the code. Resolution comes from wavelength and numerical aperture, magnification past what the optics resolve only gives a bigger blur, electron beams damage delicate samples, and X-ray maps only work above an element's absorption edge. Sample sizes, dates and history are checked against published sources, which are listed in the game's journal.

## Play it

```bash
npm install
npm run dev      # then open http://localhost:5173
```

Click the world to start. WASD to walk, E to gather or talk, F to look closer, C to craft, M for the Microdex, J for the journal, Tab for the menu.

## Status

This is a hackathon build. **Development is paused while the hackathon is being judged, and will resume once the judging phase is over.**

## More

- [How to play](docs/PLAYING.md): controls, a map of the campus, what to build, the mini-games and every system in the game.
- [Development](docs/DEVELOPMENT.md): running, code structure and contributing.
- [Design](docs/DESIGN.md): the game design and simulation model.
