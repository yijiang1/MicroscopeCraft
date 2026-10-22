import { afterEach, describe, expect, it, vi } from 'vitest';
import { createFrameLoop } from './loop';

afterEach(() => vi.unstubAllGlobals());

function scheduler() {
  let id = 0;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
    pending.set(++id, callback);
    return id;
  });
  vi.stubGlobal('cancelAnimationFrame', (key: number) => pending.delete(key));
  return {
    pending,
    tick(time: number) {
      const callbacks = [...pending.values()];
      pending.clear();
      callbacks.forEach((callback) => callback(time));
    },
  };
}

describe('world frame loop', () => {
  it('does no work while stopped and resumes once with no accumulated movement time', () => {
    const frames = scheduler();
    const render = vi.fn();
    const loop = createFrameLoop(render);
    loop.start();
    loop.start();
    expect(frames.pending.size).toBe(1);
    frames.tick(100);
    frames.tick(116);
    expect(render.mock.calls.map(([dt]) => dt)).toEqual([0, 0.016]);
    loop.stop();
    loop.stop();
    expect(frames.pending.size).toBe(0);
    frames.tick(60_000);
    expect(render).toHaveBeenCalledTimes(2);
    loop.start();
    frames.tick(60_016);
    expect(render).toHaveBeenLastCalledWith(0, 60_016);
    expect(frames.pending.size).toBe(1);
    frames.tick(61_016);
    expect(render).toHaveBeenLastCalledWith(0.05, 61_016);
    loop.stop();
  });

  it('skips frames that come sooner than the cap, and measures dt from the last drawn frame', () => {
    const frames = scheduler();
    const render = vi.fn();
    const loop = createFrameLoop(render, () => 1000 / 60);
    loop.start();
    [0, 8.3, 16.7, 25, 33.4, 50].forEach((t) => frames.tick(t)); // a 120 Hz display, then one late frame
    expect(render.mock.calls.map(([, t]) => t)).toEqual([0, 16.7, 33.4, 50]);
    expect(render.mock.calls[1]![0]).toBeCloseTo(0.0167);
    loop.stop();
  });

  it('does not reschedule when the world is stopped during a frame', () => {
    const frames = scheduler();
    const loop = createFrameLoop(() => loop.stop());
    loop.start();
    frames.tick(100);
    expect(frames.pending.size).toBe(0);
  });
});
