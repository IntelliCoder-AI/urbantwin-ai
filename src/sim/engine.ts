/** UrbanTwin's transparent browser model. Synthetic, straight-through traffic; not SUMO. */
export type Scenario = 'normal' | 'rush' | 'incident';
export type Strategy = 'fixed' | 'adaptive';
export type Phase = 'green' | 'amber' | 'clearance';
export type Signal = { axis: number; phase: Phase; elapsed: number };
export type Demand = { id: number; depart: number; route: number };
export type Vehicle = Demand & {
  p: number;
  speed: number;
  wait: number;
  delay: number;
  stops: number;
  stopped: boolean;
};
export type Config = {
  seed: number;
  scenario: Scenario;
  junctions: 1 | 4;
  demand: number;
  duration: number;
  demandUntil: number;
};
export type Metrics = {
  time: number;
  waiting: number;
  delay: number;
  queue: number;
  throughput: number;
  stops: number;
  worstWait: number;
  fairness: number;
  arrived: number;
  unfinished: number;
  pending: number;
  approachWait: number[];
};
export type Frame = {
  time: number;
  vehicles: { id: number; x: number; z: number; angle: number; speed: number }[];
  signals: Signal[];
  metrics: Metrics;
  queues: number[][];
  /** Cumulative stopped vehicle-seconds within 65 m upstream of a stop line. */
  junctionWaiting?: number[];
};
export const DEFAULT_CONFIG: Config = {
  seed: 42,
  scenario: 'rush',
  junctions: 4,
  demand: 1,
  duration: 600,
  demandUntil: 300,
};
export const DT = 0.5,
  SPEED = 10,
  GAP = 7,
  MIN_GREEN = 10,
  MAX_GREEN = 42,
  AMBER = 3,
  CLEARANCE = 3,
  FIXED_GREEN = 30;
export const NAMES = ['Indiranagar West', '100 Feet Road', 'HAL Junction', 'Domlur Link'];
export const junctionPositions = (n: 1 | 4): [number, number][] =>
  n === 1
    ? [[0, 0]]
    : [
        [-45, -45],
        [45, -45],
        [-45, 45],
        [45, 45],
      ];
export function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}
export function generateDemand(c: Config): Demand[] {
  const rng = random(c.seed);
  const out: Demand[] = [];
  const routes = c.junctions === 1 ? 4 : 8;
  for (let t = 0; t < c.demandUntil; t += DT)
    for (let r = 0; r < routes; r++) {
      const ew = r % 4 < 2;
      const rate = (c.scenario === 'normal' ? 0.075 : ew ? 0.22 : 0.055) * c.demand;
      if (rng() < rate * DT) out.push({ id: out.length, depart: t, route: r });
    }
  return out;
}
export function advanceSignal(
  signal: Signal,
  strategy: Strategy,
  queues: number[],
  oldest: number[],
  dt = DT,
): Signal {
  const s = { ...signal, elapsed: signal.elapsed + dt };
  if (s.phase === 'amber' && s.elapsed >= AMBER) return { ...s, phase: 'clearance', elapsed: 0 };
  if (s.phase === 'clearance' && s.elapsed >= CLEARANCE)
    return { axis: 1 - s.axis, phase: 'green', elapsed: 0 };
  if (s.phase !== 'green') return s;
  const active = s.axis,
    other = 1 - active;
  const change =
    strategy === 'fixed'
      ? s.elapsed >= FIXED_GREEN
      : s.elapsed >= MAX_GREEN ||
        (s.elapsed >= MIN_GREEN &&
          (oldest[other] >= 55 ||
            queues[other] + oldest[other] / 12 > queues[active] + oldest[active] / 12 + 1));
  return change ? { ...s, phase: 'amber', elapsed: 0 } : s;
}
export class Simulation {
  config: Config;
  strategy: Strategy;
  demand: Demand[];
  cursor = 0;
  time = 0;
  vehicles: Vehicle[] = [];
  pending: Vehicle[] = [];
  completed: Vehicle[] = [];
  signals: Signal[];
  queueIntegral = 0;
  junctionWaiting: number[];
  constructor(c: Config, strategy: Strategy) {
    if (
      !Number.isFinite(c.seed) ||
      c.demand < 0.1 ||
      c.demand > 3 ||
      c.duration <= 0 ||
      c.demandUntil > c.duration
    )
      throw new Error('Invalid simulation configuration');
    this.config = { ...c };
    this.strategy = strategy;
    this.junctionWaiting = junctionPositions(c.junctions).map(() => 0);
    this.demand = generateDemand(c);
    this.signals = junctionPositions(c.junctions).map(() => ({
      axis: 0,
      phase: 'green',
      elapsed: 0,
    }));
  }
  route(r: number) {
    const dir = r % 4;
    const axis = dir < 2 ? 0 : 1;
    const sign = dir % 2 === 0 ? 1 : -1;
    const road = this.config.junctions === 1 ? 0 : Math.floor(r / 4) === 0 ? -45 : 45;
    return { axis, sign, road };
  }
  point(v: Vehicle) {
    const { axis, sign, road } = this.route(v.route);
    const along = (-110 + v.p) * sign;
    return {
      x: axis === 0 ? along : road + sign * 3,
      z: axis === 0 ? road - sign * 3 : along,
      angle: axis === 0 ? (sign === 1 ? Math.PI / 2 : -Math.PI / 2) : sign === 1 ? 0 : Math.PI,
    };
  }
  crossings(r: number) {
    const { axis, sign, road } = this.route(r);
    return junctionPositions(this.config.junctions)
      .map(([x, z], i) => ({ i, p: 110 + (axis === 0 ? x : z) * sign, road: axis === 0 ? z : x }))
      .filter((j) => j.road === road)
      .sort((a, b) => a.p - b.p);
  }
  pressures() {
    const q = this.signals.map(() => [0, 0]);
    const oldest = this.signals.map(() => [0, 0]);
    for (const v of this.vehicles) {
      const axis = this.route(v.route).axis;
      for (const j of this.crossings(v.route)) {
        const dist = j.p - 10 - v.p;
        if (dist >= 0 && dist < 65) {
          q[j.i][axis]++;
          oldest[j.i][axis] = Math.max(oldest[j.i][axis], v.wait);
          break;
        }
      }
    }
    return { q, oldest };
  }
  step() {
    if (this.time >= this.config.duration) return;
    while (this.cursor < this.demand.length && this.demand[this.cursor].depart <= this.time) {
      this.pending.push({
        ...this.demand[this.cursor++],
        p: 0,
        speed: 0,
        wait: 0,
        delay: 0,
        stops: 0,
        stopped: false,
      });
    }
    const remain: Vehicle[] = [];
    for (const v of this.pending) {
      if (!this.vehicles.some((a) => a.route === v.route && a.p < GAP)) {
        v.speed = SPEED;
        this.vehicles.push(v);
      } else {
        v.wait += DT;
        v.delay += DT;
        remain.push(v);
      }
    }
    this.pending = remain;
    for (let r = 0; r < (this.config.junctions === 1 ? 4 : 8); r++) {
      const lane = this.vehicles.filter((v) => v.route === r).sort((a, b) => b.p - a.p);
      let leader = Infinity;
      for (const v of lane) {
        let target = Math.min(v.p + SPEED * DT, leader - GAP);
        const axis = this.route(r).axis;
        for (const j of this.crossings(r)) {
          const stop = j.p - 10;
          if (
            v.p <= stop + 0.001 &&
            (this.signals[j.i].phase !== 'green' ||
              this.signals[j.i].axis !== axis ||
              leader - GAP < j.p + 10)
          )
            target = Math.min(target, stop);
        }
        // Incident closes eastbound entry to junction 0 from t=90 to t=180.
        if (this.config.scenario === 'incident' && r === 0 && this.time >= 90 && this.time < 180) {
          const barrier = this.crossings(r)[0].p - 22;
          if (v.p <= barrier) target = Math.min(target, barrier);
        }
        target = Math.max(v.p, target);
        v.speed = (target - v.p) / DT;
        v.delay += DT * (1 - v.speed / SPEED);
        const stopped = v.speed < 0.1;
        if (stopped) {
          v.wait += DT;
          const junction = this.crossings(r).find((j) => {
            const distance = j.p - 10 - target;
            return distance >= 0 && distance < 65;
          });
          if (junction) this.junctionWaiting[junction.i] += DT;
          if (!v.stopped) v.stops++;
        }
        v.stopped = stopped;
        v.p = target;
        leader = v.p;
      }
    }
    const active: Vehicle[] = [];
    for (const v of this.vehicles) {
      if (v.p >= 220) this.completed.push(v);
      else active.push(v);
    }
    this.vehicles = active;
    this.time = Math.min(this.config.duration, this.time + DT);
    // Observe this completed step, then set the signal for the next interval.
    const { q, oldest } = this.pressures();
    this.signals = this.signals.map((s, i) => advanceSignal(s, this.strategy, q[i], oldest[i]));
    this.queueIntegral += this.vehicles.filter((v) => v.speed < 0.1).length * DT;
  }
  metrics(): Metrics {
    const all = [...this.completed, ...this.vehicles, ...this.pending];
    const count = all.length || 1;
    const waits = [0, 0, 0, 0],
      counts = [0, 0, 0, 0];
    for (const v of all) {
      waits[v.route % 4] += v.wait;
      counts[v.route % 4]++;
    }
    const means = waits.map((w, i) => (counts[i] ? w / counts[i] : 0));
    const present = means.filter((_, i) => counts[i]);
    const sum = present.reduce((a, b) => a + b, 0),
      sq = present.reduce((a, b) => a + b * b, 0);
    const delay = all.reduce((a, v) => a + v.delay, 0) / count;
    return {
      time: this.time,
      waiting: all.reduce((a, v) => a + v.wait, 0) / count,
      delay,
      queue: this.vehicles.filter((v) => v.speed < 0.1).length,
      throughput: this.completed.length,
      stops: all.reduce((a, v) => a + v.stops, 0),
      worstWait: Math.max(0, ...all.map((v) => v.wait)),
      fairness: sq ? (sum * sum) / (present.length * sq) : 1,
      arrived: all.length,
      unfinished: this.vehicles.length + this.pending.length,
      pending: this.pending.length,
      approachWait: means,
    };
  }
  frame(): Frame {
    return {
      time: this.time,
      vehicles: this.vehicles.map((v) => ({ id: v.id, ...this.point(v), speed: v.speed })),
      signals: this.signals.map((s) => ({ ...s })),
      metrics: this.metrics(),
      queues: this.pressures().q,
      junctionWaiting: [...this.junctionWaiting],
    };
  }
}
export function run(c: Config, strategy: Strategy) {
  const sim = new Simulation(c, strategy);
  const history: Metrics[] = [];
  while (sim.time < c.duration) {
    sim.step();
    if (sim.time % 5 === 0) history.push(sim.metrics());
  }
  return {
    metrics: sim.metrics(),
    history,
    demand: sim.demand,
    meanQueue: sim.queueIntegral / c.duration,
  };
}
export function improvement(fixed: number, adaptive: number) {
  return fixed === 0 ? null : ((fixed - adaptive) / fixed) * 100;
}
export function repeat(c: Config, seeds = [11, 22, 33, 44, 55]) {
  return seeds.map((seed) => ({
    seed,
    fixed: run({ ...c, seed }, 'fixed'),
    adaptive: run({ ...c, seed }, 'adaptive'),
  }));
}
