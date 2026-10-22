import type { Config, Frame, Metrics, Scenario } from './engine';
export type SumoRun = {
  metrics: Metrics;
  meanQueue: number;
  collisions: number;
  teleports: number;
};
export type SumoTrace = {
  engine: string;
  version: string;
  duration: number;
  config: Config;
  demandSHA256: string;
  fixed: SumoRun & { frames: Frame[] };
  adaptive: SumoRun & { frames: Frame[] };
};
export type SumoEvaluation = {
  engine: string;
  version: string;
  seeds: number[];
  duration: number;
  demandUntil: number;
  results: {
    scenario: Scenario;
    runs: {
      seed: number;
      demandSHA256: string;
      scheduledVehicles: number;
      fixed: SumoRun;
      adaptive: SumoRun;
    }[];
    waitImprovementMean: number;
    waitImprovement95CI: [number, number];
  }[];
};
