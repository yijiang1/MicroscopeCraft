/** Step timing follows distance actually travelled, not held keys or a wall-clock timer. */
export function createFootstepTracker() {
  let distanceSinceStep = 0;
  return {
    update(distance: number, groundedAndActive: boolean, running: boolean): boolean {
      if (!groundedAndActive || distance < 0.001 || distance > 2) {
        distanceSinceStep = 0;
        return false;
      }
      distanceSinceStep += distance;
      const stride = running ? 1.65 : 1.4;
      if (distanceSinceStep < stride) return false;
      distanceSinceStep %= stride;
      return true;
    },
  };
}
