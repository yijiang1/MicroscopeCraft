/** WASD remains relative to the captured character heading while the camera orbits. */
export function freeLookStep(heading: number, forward: number, right: number, distance: number) {
  return {
    x: (-Math.sin(heading) * forward + Math.cos(heading) * right) * distance,
    z: (-Math.cos(heading) * forward - Math.sin(heading) * right) * distance,
  };
}

/** Fishing owns a modal and pauses movement, but should still allow camera orbit. */
export const canFreeLook = (state: { fishing: boolean; driving: boolean; paused: boolean; pointerLocked: boolean }) =>
  state.fishing || (!state.paused && (state.driving || state.pointerLocked));
