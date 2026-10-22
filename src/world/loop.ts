/** A stoppable world loop. Restart with a zero delta so time in the eyepiece never advances movement. */
export function createFrameLoop(render: (dt: number, time: number) => void) {
  let running = false;
  let request: number | null = null;
  let previous: number | null = null;
  const frame = (time: number) => {
    if (!running) return;
    request = null;
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
