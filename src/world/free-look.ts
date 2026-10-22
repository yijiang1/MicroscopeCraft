/** WASD remains relative to the captured character heading while the camera orbits. */
export function freeLookStep(heading: number, forward: number, right: number, distance: number) {
  return {
    x: (-Math.sin(heading) * forward + Math.cos(heading) * right) * distance,
    z: (-Math.cos(heading) * forward - Math.sin(heading) * right) * distance,
  };
}
