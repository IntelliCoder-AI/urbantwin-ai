import { describe, expect, it } from 'vitest';
import { DEFAULT_CONFIG, Simulation, DT } from '../src/sim/engine';

describe('junction waiting accounting', () => {
  it('integrates detector stopped time, preserves snapshots and resets cleanly', () => {
    const sim = new Simulation(
      { ...DEFAULT_CONFIG, junctions: 1, duration: 180, demandUntil: 90 },
      'fixed',
    );
    const first = sim.frame();
    let expected = 0;
    while (sim.time < sim.config.duration) {
      sim.step();
      // Independent geometric oracle for the single junction, 10 m stop-line offset.
      for (const v of sim.frame().vehicles) {
        const forward = Math.sin(v.angle) * -v.x + Math.cos(v.angle) * -v.z;
        if (v.speed < 0.1 && forward >= 10 && forward < 75) expected += DT;
      }
      expect(sim.frame().junctionWaiting![0]).toBe(expected);
    }
    expect(expected).toBeGreaterThan(0);
    expect(sim.frame().metrics.queue).toBe(0);
    expect(first.junctionWaiting).toEqual([0]);
    expect(new Simulation(DEFAULT_CONFIG, 'fixed').frame().junctionWaiting).toEqual([0, 0, 0, 0]);
  });
  it('does not alter the published seed-42 incident outcome', () => {
    const f = new Simulation({ ...DEFAULT_CONFIG, scenario: 'incident' }, 'fixed');
    const a = new Simulation({ ...DEFAULT_CONFIG, scenario: 'incident' }, 'adaptive');
    for (const sim of [f, a]) while (sim.time < 600) sim.step();
    expect(f.metrics().waiting).toBeCloseTo(79.23899371069183, 10);
    expect(a.metrics().waiting).toBeCloseTo(46.611635220125784, 10);
    expect(f.metrics().stops).toBe(1897);
    expect(a.metrics().stops).toBe(2272);
    expect(a.frame().junctionWaiting!.reduce((x, y) => x + y, 0)).toBeLessThanOrEqual(
      a.metrics().waiting * a.metrics().arrived,
    );
  });
});
