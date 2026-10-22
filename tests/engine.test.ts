import { describe, it, expect } from 'vitest';
import {
  Simulation,
  DEFAULT_CONFIG,
  generateDemand,
  advanceSignal,
  run,
  improvement,
  MIN_GREEN,
  MAX_GREEN,
  DT,
} from '../src/sim/engine';
describe('reproducible matched experiments', () => {
  it('uses identical exogenous demand for both controllers', () => {
    const f = new Simulation(DEFAULT_CONFIG, 'fixed'),
      a = new Simulation(DEFAULT_CONFIG, 'adaptive');
    expect(f.demand).toEqual(a.demand);
    expect(generateDemand({ ...DEFAULT_CONFIG, seed: 43 })).not.toEqual(f.demand);
  });
  it('repeats exactly, including metrics', () =>
    expect(run({ ...DEFAULT_CONFIG, duration: 120, demandUntil: 60 }, 'adaptive')).toEqual(
      run({ ...DEFAULT_CONFIG, duration: 120, demandUntil: 60 }, 'adaptive'),
    ));
  it('handles no traffic without NaN', () => {
    const r = run({ ...DEFAULT_CONFIG, demandUntil: 0 }, 'adaptive');
    expect(r.metrics.waiting).toBe(0);
    expect(r.metrics.fairness).toBe(1);
    expect(improvement(0, 0)).toBeNull();
  });
});
describe('signal safety', () => {
  it('enforces minimum green and amber/all-red before conflicting green', () => {
    let s = { axis: 0, phase: 'green' as const, elapsed: 0 };
    expect(advanceSignal(s, 'adaptive', [0, 99], [0, 100]).phase).toBe('green');
    let a = advanceSignal({ ...s, elapsed: MIN_GREEN - DT }, 'adaptive', [0, 99], [0, 100]);
    expect(a.phase).toBe('amber');
    a = advanceSignal({ ...a, elapsed: 2.5 }, 'adaptive', [0, 99], [0, 100]);
    expect(a.phase).toBe('clearance');
    expect(a.axis).toBe(0);
    a = advanceSignal({ ...a, elapsed: 2.5 }, 'adaptive', [0, 99], [0, 100]);
    expect(a).toEqual({ phase: 'green', axis: 1, elapsed: 0 });
  });
  it('caps green even under dominant demand', () =>
    expect(
      advanceSignal(
        { axis: 0, phase: 'green', elapsed: MAX_GREEN - DT },
        'adaptive',
        [100, 1],
        [10, 0],
      ).phase,
    ).toBe('amber'));
});
describe.each([1, 4] as const)('%i junction physical consistency', (junctions) => {
  it('conserves demand, maintains lane gaps and respects red stop lines', () => {
    const s = new Simulation(
      {
        ...DEFAULT_CONFIG,
        junctions,
        duration: 180,
        demandUntil: 100,
        demand: 2,
        scenario: 'incident',
      },
      'adaptive',
    );
    while (s.time < s.config.duration) {
      const before = new Map(s.vehicles.map((v) => [v.id, v.p]));
      const movementSignals = s.signals.map((signal) => ({ ...signal }));
      s.step();
      expect(s.completed.length + s.pending.length + s.vehicles.length).toBe(s.cursor);
      for (let r = 0; r < (junctions === 1 ? 4 : 8); r++) {
        const lane = s.vehicles.filter((v) => v.route === r).sort((a, b) => a.p - b.p);
        for (let i = 1; i < lane.length; i++)
          expect(lane[i].p - lane[i - 1].p).toBeGreaterThanOrEqual(6.999);
        for (const v of lane)
          for (const j of s.crossings(r)) {
            const signal = movementSignals[j.i];
            if (
              before.has(v.id) &&
              before.get(v.id)! <= j.p - 10 &&
              (signal.phase !== 'green' || signal.axis !== s.route(r).axis)
            )
              expect(v.p).toBeLessThanOrEqual(j.p - 10 + 0.001);
          }
      }
    }
    expect(s.metrics().throughput).toBeGreaterThan(0);
    expect(s.metrics().worstWait).toBeGreaterThanOrEqual(s.metrics().waiting);
  });
});

describe('downstream blockage safety', () => {
  for (const strategy of ['fixed', 'adaptive'] as const) {
    for (const scenario of ['normal', 'rush', 'incident'] as const) {
      for (const demand of [1, 2]) {
        it(`${strategy} ${scenario} ${demand}× keeps perpendicular vehicles apart`, () => {
          const sim = new Simulation({ ...DEFAULT_CONFIG, scenario, demand }, strategy);
          let overlaps = 0;
          while (sim.time < sim.config.duration) {
            sim.step();
            const cars = sim.vehicles.map((v) => ({
              ...sim.point(v),
              axis: sim.route(v.route).axis,
            }));
            for (let i = 0; i < cars.length; i++)
              for (let j = i + 1; j < cars.length; j++) {
                // 4.2 m × 2.1 m vehicle footprints; opposing lanes share an axis.
                if (
                  cars[i].axis !== cars[j].axis &&
                  Math.abs(cars[i].x - cars[j].x) < 3.15 &&
                  Math.abs(cars[i].z - cars[j].z) < 3.15
                )
                  overlaps++;
              }
          }
          expect(overlaps).toBe(0);
        });
      }
    }
  }
});

it('uses complete fixed green and clearance intervals on the simulation clock', () => {
  const sim = new Simulation({ ...DEFAULT_CONFIG, demandUntil: 0 }, 'fixed');
  for (let i = 0; i < 59; i++) sim.step();
  expect(sim.time).toBe(29.5);
  expect(sim.signals[0].phase).toBe('green');
  sim.step();
  expect(sim.time).toBe(30);
  expect(sim.signals[0].phase).toBe('amber');
  for (let i = 0; i < 6; i++) sim.step();
  expect(sim.time).toBe(33);
  expect(sim.signals[0].phase).toBe('clearance');
  for (let i = 0; i < 6; i++) sim.step();
  expect(sim.time).toBe(36);
  expect(sim.signals[0]).toEqual({ axis: 1, phase: 'green', elapsed: 0 });
});
