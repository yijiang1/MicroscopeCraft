/** A stoppable world loop. Restart with a zero delta so time in the eyepiece never advances movement.
 *  minFrameMs caps the frame rate: a 120 Hz display would otherwise draw the world twice as often for no gain. */
export function createFrameLoop(render: (dt: number, time: number) => void, minFrameMs: () => number = () => 0) {
  let running = false;
  let request: number | null = null;
  let previous: number | null = null;
  const frame = (time: number) => {
    if (!running) return;
    request = null;
    // 2 ms of slack, so a 60 Hz display whose frames arrive a little early still draws every one
    if (previous !== null && time - previous < minFrameMs() - 2) {
      request = requestAnimationFrame(frame);
      return;
    }
    const dt = previous === null ? 0 : Math.min((time - previous) / 1000, 0.05);
    previous = time;
    render(dt, time);
    if (running) request = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      previous = null;
      request = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      if (request !== null) cancelAnimationFrame(request);
      request = null;
      previous = null;
    },
  };
}
