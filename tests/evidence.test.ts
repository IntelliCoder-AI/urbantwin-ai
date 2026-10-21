import { readFileSync, existsSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
for (const scenario of ['normal', 'rush', 'incident']) {
  describe(`SUMO ${scenario} evidence`, () => {
    const path = `public/data/sumo-${scenario}-42.json`;
    it('has aligned replay clocks, conserved cohorts and collision-free runs', () => {
      expect(existsSync(path)).toBe(true);
      const trace = JSON.parse(readFileSync(path, 'utf8'));
      expect(trace.version).toBe('1.28.0');
      expect(trace.demandSHA256).toMatch(/^[0-9a-f]{64}$/);
      for (const strategy of ['fixed', 'adaptive']) {
        const run = trace[strategy];
        expect(run.collisions).toBe(0);
        expect(run.teleports).toBe(0);
        expect(run.frames).toHaveLength(601);
        for (let i = 0; i < run.frames.length; i++) {
          const f = run.frames[i];
          expect(f.time).toBe(i);
          expect(f.signals).toHaveLength(4);
          expect(f.metrics.unfinished + f.metrics.throughput).toBe(f.metrics.arrived);
          expect(f.metrics.worstWait).toBeGreaterThanOrEqual(f.metrics.waiting);
          expect(f.metrics.delay).toBeGreaterThanOrEqual(0);
          expect(new Set(f.vehicles.map((v: any) => v.id)).size).toBe(f.vehicles.length);
        }
      }
      expect(trace.fixed.metrics.arrived).toBe(trace.adaptive.metrics.arrived);
    });
  });
}
