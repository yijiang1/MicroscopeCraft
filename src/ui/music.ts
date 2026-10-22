/** Traditional public-domain melody, arranged for the tower's synthesized bells. */
export const TANNENBAUM: readonly (readonly [number, number])[] = [
  [67,1],[72,1.5],[72,.5],[72,2],[74,1],[76,1.5],[76,.5],[76,2],
  [76,1],[74,1],[76,1],[77,1],[71,2],[74,2],[72,3],
  [67,1],[72,1.5],[72,.5],[72,2],[74,1],[76,1.5],[76,.5],[76,2],
  [76,1],[74,1],[76,1],[77,1],[71,2],[74,2],[72,3],
  [79,1],[79,1],[76,1],[81,2],[79,1],[79,1],[77,1],[77,3],
  [77,1],[77,1],[74,1],[79,2],[77,1],[77,1],[76,1],[76,2],
  [67,1],[72,1.5],[72,.5],[72,2],[74,1],[76,1.5],[76,.5],[76,2],
  [76,1],[74,1],[76,1],[77,1],[71,2],[74,2],[72,4],
];
/** Two original, quiet eight-bar themes: campus celesta and laboratory marimba. */
export const CAMPUS_THEME = [60,64,67,71,69,67,64,62,57,60,64,67,65,64,62,59];
export const LAB_THEME = [62,69,65,72,69,65,64,69,60,67,64,71,67,64,62,67];
export const midiHz = (note: number) => 440 * 2 ** ((note - 69) / 12);
export const TOWER_MUSIC_INTERVAL = 300;
