import { writeFileSync } from 'node:fs';
import { DEFAULT_CONFIG, repeat, improvement } from '../src/sim/engine';
const scenarios = ['normal', 'rush', 'incident'] as const;
const results = scenarios.map((scenario) => {
  const runs = repeat({ ...DEFAULT_CONFIG, scenario });
  const delta = runs.map(
    (r) => improvement(r.fixed.metrics.waiting, r.adaptive.metrics.waiting) ?? 0,
  );
  const mean = delta.reduce((a, b) => a + b) / delta.length;
  const sd = Math.sqrt(delta.reduce((a, b) => a + (b - mean) ** 2, 0) / (delta.length - 1));
  return {
    scenario,
    runs: runs.map((r) => ({
      seed: r.seed,
      fixed: r.fixed.metrics,
      adaptive: r.adaptive.metrics,
      fixedMeanQueue: r.fixed.meanQueue,
      adaptiveMeanQueue: r.adaptive.meanQueue,
    })),
    waitImprovementMean: mean,
    waitImprovementSD: sd,
    waitImprovement95CI: [mean - (2.776 * sd) / Math.sqrt(5), mean + (2.776 * sd) / Math.sqrt(5)],
  };
});
writeFileSync(
  'public/data/browser-evaluation.json',
  JSON.stringify(
    { engine: 'UrbanTwin browser model v1', config: DEFAULT_CONFIG, results },
    null,
    2,
  ),
);
console.log(
  results.map(({ scenario, waitImprovementMean, waitImprovement95CI }) => ({
    scenario,
    waitImprovementMean,
    waitImprovement95CI,
  })),
);
