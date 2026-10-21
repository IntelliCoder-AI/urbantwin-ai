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
      s.step();
      expect(s.completed.length + s.pending.length + s.vehicles.length).toBe(s.cursor);
      for (let r = 0; r < (junctions === 1 ? 4 : 8); r++) {
        const lane = s.vehicles.filter((v) => v.route === r).sort((a, b) => a.p - b.p);
        for (let i = 1; i < lane.length; i++)
          expect(lane[i].p - lane[i - 1].p).toBeGreaterThanOrEqual(6.999);
        for (const v of lane)
          for (const j of s.crossings(r)) {
            const signal = s.signals[j.i];
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
