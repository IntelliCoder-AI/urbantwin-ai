import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Box,
  Check,
  Clock3,
  Download,
  FlaskConical,
  Focus,
  GitCompareArrows,
  Globe2,
  Layers3,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  Route,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  TrafficCone,
  X,
  Zap,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import {
  Simulation,
  DEFAULT_CONFIG,
  NAMES,
  improvement,
  repeat,
  type Config,
  type Frame,
  type Metrics,
  type Scenario,
  type Strategy,
} from './sim/engine';
import type { SumoTrace, SumoEvaluation } from './sim/evidence';
import { answerTrafficQuestion } from './sim/assistant';
import { useViewRoute } from './navigation';
import { parseSeed } from './sim/validation';
const PLAYBACK_SPEEDS = [1, 2, 4, 8, 16];
const City = lazy(() => import('./components/City'));
const tabs = [
  { name: 'City overview', icon: Globe2 },
  { name: 'Control center', icon: Settings2 },
  { name: 'Counterfactual lab', icon: FlaskConical },
  { name: 'AI insights', icon: Sparkles },
  { name: 'Methodology', icon: Layers3 },
];
const labels: Record<Scenario, string> = {
  normal: 'Normal traffic',
  rush: 'Rush hour',
  incident: 'Road incident',
};
const format = (n: number) => (Number.isFinite(n) ? n.toFixed(1) : '—');
const clock = (t: number) =>
  `${String(Math.floor(t / 60)).padStart(2, '0')}:${String(Math.floor(t % 60)).padStart(2, '0')}`;
function download(data: unknown, name: string) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(
    new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }),
  );
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
function useTwin(config: Config, playing: boolean, speed: number) {
  const [initialSims] = useState(() => ({
    fixed: new Simulation(config, 'fixed'),
    adaptive: new Simulation(config, 'adaptive'),
  }));
  const sims = useRef(initialSims);
  const [frames, setFrames] = useState(() => ({
    fixed: sims.current.fixed.frame(),
    adaptive: sims.current.adaptive.frame(),
  }));
  const [history, setHistory] = useState<
    { time: number; fixed: number; adaptive: number; queue: number }[]
  >([]);
  const [resetVersion, setResetVersion] = useState(0);
  const reset = () => {
    sims.current = {
      fixed: new Simulation(config, 'fixed'),
      adaptive: new Simulation(config, 'adaptive'),
    };
    setFrames({ fixed: sims.current.fixed.frame(), adaptive: sims.current.adaptive.frame() });
    setHistory([]);
    setResetVersion((v) => v + 1);
  };
  useEffect(reset, [config]);
  useEffect(() => {
    if (!playing) return;
    let accumulator = 0;
    const timer = setInterval(() => {
      if (sims.current.fixed.time >= config.duration) {
        clearInterval(timer);
        return;
      }
      accumulator += speed * 0.1;
      let moved = false;
      const samples: { time: number; fixed: number; adaptive: number; queue: number }[] = [];
      while (accumulator >= 0.5) {
        sims.current.fixed.step();
        sims.current.adaptive.step();
        accumulator -= 0.5;
        moved = true;
        if (sims.current.fixed.time % 5 === 0) {
          const f = sims.current.fixed.metrics(),
            a = sims.current.adaptive.metrics();
          samples.push({ time: f.time, fixed: f.waiting, adaptive: a.waiting, queue: a.queue });
        }
        if (sims.current.fixed.time >= config.duration) break;
      }
      if (moved) {
        const f = sims.current.fixed.frame(),
          a = sims.current.adaptive.frame();
        setFrames({ fixed: f, adaptive: a });
        if (samples.length) setHistory((h) => [...h, ...samples].slice(-121));
      }
    }, 100);
    return () => clearInterval(timer);
  }, [config, playing, speed, resetVersion]);
  return { frames, history, reset };
}
function Delta({ value }: { value: number | null }) {
  return (
    <span className={`delta ${value !== null && value < 0 ? 'negative' : ''}`}>
      {value === null ? (
        'No baseline yet'
      ) : (
        <>
          {value >= 0 ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />} Adaptive:{' '}
          {Math.abs(value).toFixed(1)}% {value >= 0 ? 'lower' : 'higher'} vs fixed-time
        </>
      )}
    </span>
  );
}
function Chart({ data, compare = false }: { data: unknown[]; compare?: boolean }) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data}>
        <defs>
          <linearGradient id="mint" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#44d9b1" stopOpacity={0.25} />
            <stop offset="100%" stopColor="#44d9b1" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#26313b" strokeDasharray="3 5" vertical={false} />
        <XAxis
          dataKey="time"
          tickFormatter={clock}
          tick={{ fill: '#788895', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          minTickGap={35}
        />
        <YAxis
          tick={{ fill: '#788895', fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={28}
        />
        <Tooltip
          contentStyle={{ background: '#17232e', border: '1px solid #31414e', borderRadius: 8 }}
          labelFormatter={(v) => `${clock(Number(v))} elapsed`}
        />
        {compare && (
          <Area
            isAnimationActive={false}
            type="monotone"
            dataKey="fixed"
            name="Fixed wait (s)"
            stroke="#b2a0ed"
            fill="transparent"
            strokeWidth={2}
          />
        )}
        <Area
          isAnimationActive={false}
          type="monotone"
          dataKey="adaptive"
          name="Adaptive wait (s)"
          stroke="#44d9b1"
          fill="url(#mint)"
          strokeWidth={2}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
function insights(f: Metrics, a: Metrics, scenario: Scenario) {
  const pct = improvement(f.waiting, a.waiting);
  const dirs = ['eastbound', 'westbound', 'southbound', 'northbound'];
  const worst = a.approachWait.indexOf(Math.max(...a.approachWait));
  return [
    {
      title: 'What the comparison tells us',
      body: `At ${clock(a.time)}, adaptive control records ${format(a.waiting)} s mean waiting versus ${format(f.waiting)} s with fixed timing.${pct === null ? ' More traffic is needed for a percentage comparison.' : ` This is ${Math.abs(pct).toFixed(1)}% ${pct >= 0 ? 'lower' : 'higher'} waiting for the same seed and arrivals.`} ${a.time >= 600 ? 'This run is complete' : 'These are partial-run results'}; rerun multiple seeds before drawing a conclusion.`,
    },
    {
      title: 'Watch the least-served approach',
      body: `The ${dirs[worst]} approaches have the highest mean wait: ${format(a.approachWait[worst])} s. The worst individual accumulated wait is ${format(a.worstWait)} s. A 42 s green cap prevents one signal axis from holding green indefinitely; overloaded roads can still accumulate long queues.`,
    },
    {
      title:
        scenario === 'incident'
          ? 'Treat the cause, not just the signal'
          : 'A practical next experiment',
      body:
        scenario === 'incident'
          ? 'A synthetic incident restricts eastbound traffic at junction 01 between 01:30 and 03:00 (a browser stop barrier; a 0.1 m/s incoming-lane limit in SUMO). Signals cannot remove that bottleneck. Compare queue recovery after the obstruction clears before proposing extra green time.'
          : 'Reduce demand by 20% in Control center and repeat the experiment. This tests a demand-management hypothesis; it does not predict the effect of any specific real-world intervention.',
    },
  ];
}
export default function App() {
  const [tab, setTab] = useViewRoute();
  const [seedDraft, setSeedDraft] = useState(String(DEFAULT_CONFIG.seed));
  const draftSeed = parseSeed(seedDraft);
  const [config, setConfig] = useState<Config>(DEFAULT_CONFIG),
    [playing, setPlaying] = useState(
      () => !window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    ),
    [speed, setSpeed] = useState(4),
    [strategy, setStrategy] = useState<Strategy>('adaptive'),
    [selected, setSelected] = useState(0),
    [heat, setHeat] = useState(true),
    [camera, setCamera] = useState(0),
    [notice, setNotice] = useState(''),
    [question, setQuestion] = useState(''),
    [answer, setAnswer] = useState(''),
    [batch, setBatch] = useState<ReturnType<typeof repeat> | null>(null),
    [busy, setBusy] = useState(false),
    [sumo, setSumo] = useState<SumoEvaluation | null>(null),
    [replay, setReplay] = useState<SumoTrace | null>(null),
    [source, setSource] = useState<'browser' | 'sumo'>('browser'),
    [replayTime, setReplayTime] = useState(0);
  useEffect(() => setAnswer(''), [config, source, strategy]);
  useEffect(() => {
    document.title = `${tabs[tab]?.name ?? 'Page not found'} · UrbanTwin AI`;
  }, [tab]);
  const { frames, history, reset } = useTwin(config, playing && source === 'browser', speed);
  useEffect(() => {
    fetch('/data/sumo-evaluation.json')
      .then((r) => (r.ok ? r.json() : null))
      .then(setSumo)
      .catch(() => {});
  }, []);
  useEffect(() => {
    if (source !== 'sumo') return;
    setReplay(null);
    setReplayTime(0);
    const ac = new AbortController();
    fetch(`/data/sumo-${config.scenario}-42.json`, { signal: ac.signal })
      .then((r) => {
        if (!r.ok) throw Error('Trace unavailable');
        return r.json();
      })
      .then(setReplay)
      .catch((e) => {
        if (e.name !== 'AbortError') {
          setNotice('SUMO replay is unavailable. The browser simulator is still ready.');
          setSource('browser');
        }
      });
    return () => ac.abort();
  }, [source, config.scenario]);
  useEffect(() => {
    if (!playing || source !== 'sumo' || !replay) return;
    const t = setInterval(
      () => setReplayTime((v) => Math.min(replay.duration, v + speed * 0.1)),
      100,
    );
    return () => clearInterval(t);
  }, [playing, speed, source, replay]);
  const emptyFrames = useMemo(() => {
    const empty = new Simulation({ ...DEFAULT_CONFIG, demandUntil: 0 }, 'fixed').frame();
    return { fixed: empty, adaptive: empty };
  }, []);
  const activeFrames =
    source === 'sumo' && replay
      ? {
          fixed: replay.fixed.frames[
            Math.min(Math.floor(replayTime), replay.fixed.frames.length - 1)
          ] as Frame,
          adaptive: replay.adaptive.frames[
            Math.min(Math.floor(replayTime), replay.adaptive.frames.length - 1)
          ] as Frame,
        }
      : source === 'sumo'
        ? emptyFrames
        : frames;
  const f = activeFrames.fixed.metrics,
    a = activeFrames.adaptive.metrics,
    frame = activeFrames[strategy],
    m = frame.metrics;
  const chartHistory =
    source === 'sumo' && replay
      ? replay.fixed.frames
          .filter((v: Frame) => v.time <= replayTime && v.time % 5 === 0)
          .map((v: Frame) => ({
            time: v.time,
            fixed: v.metrics.waiting,
            adaptive: replay.adaptive.frames[v.time].metrics.waiting,
          }))
      : history;
  const signal = frame.signals[selected];
  const notes = insights(f, a, config.scenario);
  const change = (patch: Partial<Config>) => {
    setConfig((c) => ({ ...c, ...patch }));
    setBatch(null);
    batchWorker.current?.terminate();
    setBusy(false);
    setSelected(0);
  };
  const restart = () => {
    setAnswer('');
    reset();
    setReplayTime(0);
    setPlaying(true);
  };
  const exportResult = () =>
    download(
      {
        engine:
          source === 'sumo' ? 'Eclipse SUMO 1.28.0 recorded replay' : 'UrbanTwin browser model v1',
        config: source === 'sumo' ? replay?.config : config,
        time: frame.time,
        fixed: f,
        adaptive: a,
        junctionWaiting: {
          unit: 'vehicle-seconds',
          detectionDistanceMeters: 65,
          stoppedBelowMetersPerSecond: 0.1,
          stepSeconds: 0.5,
          excludes: 'outside detector zones and vehicles waiting to enter',
          fixed: activeFrames.fixed.junctionWaiting ?? null,
          adaptive: activeFrames.adaptive.junctionWaiting ?? null,
        },
        batch: batch ? { engine: 'UrbanTwin browser model v1', config, runs: batch } : null,
      },
      'urbantwin-experiment.json',
    );
  const batchWorker = useRef<Worker | null>(null);
  useEffect(() => () => batchWorker.current?.terminate(), []);
  function runBatch() {
    setBusy(true);
    batchWorker.current?.terminate();
    const worker = new Worker(new URL('./sim/evaluate.worker.ts', import.meta.url), {
      type: 'module',
    });
    batchWorker.current = worker;
    worker.onmessage = (e) => {
      if (e.data.error) setNotice('Experiment failed: ' + e.data.error);
      else setBatch(e.data.result);
      setBusy(false);
      worker.terminate();
    };
    worker.onerror = () => {
      setNotice('Experiment failed to start. Please retry.');
      setBusy(false);
      worker.terminate();
    };
    worker.postMessage(config);
  }
  const ask = () => {
    if (!question.trim()) return;
    setAnswer(
      answerTrafficQuestion(question, {
        ...activeFrames,
        scenario: config.scenario,
        strategy,
        source,
      }),
    );
    setQuestion('');
  };
  return (
    <div className="app">
      <aside className="sidebar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setTab(0);
          }}
        >
          <div className="brand-icon">
            <Box size={25} />
          </div>
          <span>
            UrbanTwin<span className="brand-ai"> AI</span>
            <small>URBAN INTELLIGENCE PLATFORM</small>
          </span>
        </a>
        <div className="workspace-label">
          WORKSPACE <span>01</span>
        </div>
        <nav aria-label="Main navigation">
          {tabs.map((t, i) => (
            <button
              key={t.name}
              aria-label={t.name}
              aria-current={tab === i ? 'page' : undefined}
              onClick={() => setTab(i)}
              className={tab === i ? 'nav-item active' : 'nav-item'}
            >
              <t.icon size={18} />
              <span>{t.name}</span>
              {i === 2 && <span className="new-tag">LAB</span>}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="project-card">
            <span className="tiny green">
              <i className="dot" /> ZETA INNOVATE 2026
            </span>
            <strong>
              A better city starts
              <br />
              with a better question.
            </strong>
            <span>Simulate. Compare. Reimagine.</span>
            <button onClick={() => setTab(4)}>
              Explore the methodology <ArrowUpRight size={15} />
            </button>
          </div>
          <div className="profile">
            <div className="avatar">UT</div>
            <div>
              UrbanTwin Research<small>Synthetic district · v1.0</small>
            </div>
            <ShieldCheck size={17} />
          </div>
        </div>
      </aside>
      <main>
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <span>/</span> <b>{tabs[tab]?.name ?? 'Page not found'}</b>
          </div>
          <div className="topbar-right">
            <span className="status-pill">
              <i className="dot" />
              {source === 'sumo' ? 'Recorded SUMO' : 'Simulation online'}
            </span>
            <button className="icon-btn" title="Open methodology" onClick={() => setTab(4)}>
              <Layers3 size={17} />
            </button>
            <div className="avatar small">UT</div>
          </div>
        </header>
        <div className="content">
          <div className="page-title">
            <div>
              <div className="eyebrow">BENGALURU, REIMAGINED</div>
              <h1>
                {tab === -1
                  ? 'Page not found'
                  : tab === 0
                    ? 'Your city. A little more intelligent.'
                    : tab === 1
                      ? 'Put a different city in motion.'
                      : tab === 2
                        ? 'One city. Two possible futures.'
                        : tab === 3
                          ? 'From traffic data to understanding.'
                          : 'Built to question. Designed to prove.'}
              </h1>
              <p>
                {tab === -1
                  ? 'This address does not match an UrbanTwin view. Choose a view in the navigation or return to the city.'
                  : tab === 0
                    ? 'Explore the district. Understand the flow. Discover what could be better.'
                    : tab === 1
                      ? 'Change the conditions, then observe how both controllers respond.'
                      : tab === 2
                        ? 'Matched demand. Identical seeds. Measured outcomes.'
                        : tab === 3
                          ? 'Evidence-grounded explanations, with no paid AI dependency.'
                          : 'A transparent, reproducible experiment in urban mobility.'}
              </p>
            </div>
            <button className="button subtle" onClick={exportResult}>
              <Download size={15} /> Export results
            </button>
          </div>
          {tab === -1 ? (
            <section className="panel method-card">
              <button className="button primary" onClick={() => setTab(0)}>
                Return to city overview
              </button>
            </section>
          ) : (
            <>
              {source === 'sumo' && !replay && (
                <div className="notice" role="status">
                  Loading recorded SUMO experiment…
                </div>
              )}
              {notice && (
                <div className="notice">
                  {notice}
                  <button className="icon-btn" onClick={() => setNotice('')} aria-label="Dismiss">
                    <X size={15} />
                  </button>
                </div>
              )}
              <div className="scenario-bar">
                <div className="district-label">
                  <MapPin size={17} />
                  <span>
                    Indiranagar district<small>Bengaluru-inspired · synthetic network</small>
                  </span>
                </div>
                <div className="scenario-controls">
                  <label className="select-wrap">
                    <TrafficCone size={14} />
                    <select
                      aria-label="Traffic scenario"
                      value={config.scenario}
                      onChange={(e) => change({ scenario: e.target.value as Scenario })}
                    >
                      {Object.entries(labels).map(([k, v]) => (
                        <option key={k} value={k}>
                          {v}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="select-wrap">
                    <Layers3 size={14} />
                    <select
                      aria-label="Simulation source"
                      value={source}
                      onChange={(e) => {
                        setSource(e.target.value as 'browser' | 'sumo');
                        setSelected(0);
                      }}
                    >
                      <option value="browser">Live browser model</option>
                      <option value="sumo">Recorded SUMO · seed 42</option>
                    </select>
                  </label>
                  <span className="seed">SEED {source === 'sumo' ? 42 : config.seed}</span>
                </div>
              </div>
              {tab !== 4 && (
                <div className="metrics-grid">
                  {[
                    {
                      label: 'AVERAGE WAITING TIME',
                      value: format(m.waiting),
                      unit: 'sec',
                      icon: Clock3,
                      detail: <Delta value={improvement(f.waiting, a.waiting)} />,
                    },
                    {
                      label: 'NETWORK QUEUE',
                      value: m.queue,
                      unit: 'vehicles',
                      icon: Route,
                      detail: <span>Stopped on the network</span>,
                    },
                    {
                      label: 'COMPLETED TRIPS',
                      value: m.throughput,
                      unit: 'vehicles',
                      icon: ArrowUpRight,
                      detail: <span>{m.unfinished} trips still in progress</span>,
                    },
                    {
                      label: 'WORST-CASE WAIT',
                      value: format(m.worstWait),
                      unit: 'sec',
                      icon: ShieldCheck,
                      detail: <span>All released vehicles included</span>,
                    },
                  ].map((k) => (
                    <div className="metric-card" key={k.label}>
                      <div className="metric-label">
                        {k.label}
                        <k.icon size={16} />
                      </div>
                      <div className="metric-value">
                        {k.value}
                        <span>{k.unit}</span>
                      </div>
                      <div className="metric-detail">{k.detail}</div>
                    </div>
                  ))}
                </div>
              )}
              {(tab === 0 || tab === 1) && (
                <div className="overview-grid">
                  <section className="panel city-panel">
                    <div className="panel-heading">
                      <div>
                        <i className="dot" />
                        <h2>District digital twin</h2>
                        <span className="tag">3D LIVE VIEW</span>
                      </div>
                      <div className="segmented">
                        <button
                          className={strategy === 'fixed' ? 'selected' : ''}
                          onClick={() => setStrategy('fixed')}
                        >
                          Fixed-time
                        </button>
                        <button
                          className={strategy === 'adaptive' ? 'selected' : ''}
                          onClick={() => setStrategy('adaptive')}
                        >
                          <Zap size={12} /> Adaptive
                        </button>
                      </div>
                    </div>
                    <div className="city-stage">
                      <Suspense
                        fallback={<div className="canvas-fallback">Assembling your district…</div>}
                      >
                        <City
                          playing={playing}
                          speed={speed}
                          frame={frame}
                          junctions={source === 'sumo' ? 4 : config.junctions}
                          selected={selected}
                          onSelect={setSelected}
                          heat={heat}
                          camera={camera}
                        />
                      </Suspense>
                      <div className="map-caption">
                        <span>
                          <i className="dot" />{' '}
                          {frame.time >= 600 ? 'COMPLETE' : playing ? 'RUNNING' : 'PAUSED'}
                        </span>
                        <strong>
                          {source === 'sumo' ? 'SUMO trace replay' : 'Newly calculated simulation'}
                        </strong>
                        <small>
                          {source === 'sumo'
                            ? 'Recorded positions · 1 second samples'
                            : 'Deterministic browser engine · 0.5 second steps'}
                        </small>
                      </div>
                      <div className="map-tools">
                        <button
                          title="Reset camera"
                          aria-label="Reset camera"
                          onClick={() => setCamera((c) => c + 1)}
                        >
                          <Focus size={17} />
                        </button>
                        <button
                          title="Toggle congestion overlay"
                          aria-label="Toggle congestion overlay"
                          aria-pressed={heat}
                          className={heat ? 'active' : ''}
                          onClick={() => setHeat(!heat)}
                        >
                          <Layers3 size={17} />
                        </button>
                      </div>
                      <div className="map-legend">
                        <span>
                          <i style={{ background: '#49d7ae' }} />
                          Low queue
                        </span>
                        <span>
                          <i style={{ background: '#ffb56b' }} />
                          High queue
                        </span>
                        <span className="orbit-hint">Drag to orbit · scroll to zoom</span>
                      </div>
                      <div className="compass">
                        N<span>↑</span>
                      </div>
                    </div>
                    <div className="playback">
                      <button
                        className="play-button"
                        aria-label={playing ? 'Pause simulation' : 'Play simulation'}
                        onClick={() => setPlaying(!playing)}
                      >
                        {playing ? <Pause size={16} /> : <Play size={16} />}
                      </button>
                      <button
                        className="icon-btn"
                        aria-label="Restart simulation"
                        onClick={restart}
                      >
                        <RotateCcw size={16} />
                      </button>
                      <span className="time-code">
                        {clock(frame.time)} <span>/ 10:00</span>
                      </span>
                      <div className="progress-track">
                        <i style={{ width: `${frame.time / 6}%` }} />
                      </div>
                      <select
                        aria-label="Playback speed"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                      >
                        {PLAYBACK_SPEEDS.map((s) => (
                          <option key={s} value={s}>
                            {s}× speed
                          </option>
                        ))}
                      </select>
                    </div>
                  </section>
                  <aside className="right-rail">
                    <section className="panel junction-panel">
                      <div className="panel-heading">
                        <h2>Intersection focus</h2>
                        <span className="tiny">
                          {String(selected + 1).padStart(2, '0')} /{' '}
                          {source === 'sumo' ? 4 : config.junctions}
                        </span>
                      </div>
                      <div className="junction-body">
                        <select
                          className="junction-select"
                          aria-label="Selected intersection"
                          value={selected}
                          onChange={(e) => setSelected(Number(e.target.value))}
                        >
                          {NAMES.slice(0, source === 'sumo' ? 4 : config.junctions).map(
                            (name, i) => (
                              <option key={name} value={i}>
                                {String(i + 1).padStart(2, '0')} · {name}
                              </option>
                            ),
                          )}
                        </select>
                        <div className="intersection-title">
                          <div className="intersection-symbol">
                            <Route size={22} />
                          </div>
                          <div>
                            <h3>{NAMES[selected]}</h3>
                            <span>
                              Junction {String(selected + 1).padStart(2, '0')} · connected corridor
                            </span>
                          </div>
                        </div>
                        <div className="signal-state">
                          <span>
                            <i className={`dot ${signal?.phase === 'green' ? '' : 'amber'}`} />
                            {signal?.phase === 'clearance'
                              ? 'All-red clearance'
                              : `${signal?.axis === 0 ? 'East–West' : 'North–South'} ${signal?.phase}`}
                          </span>
                          <b>{format(signal?.elapsed ?? 0)} s</b>
                        </div>
                        {['East–West', 'North–South'].map((dir, i) => (
                          <div className="queue-row" key={dir}>
                            <span>{dir}</span>
                            <div>
                              <i
                                style={{
                                  width: `${Math.min(100, (frame.queues[selected]?.[i] ?? 0) * 6)}%`,
                                  background: i === signal?.axis ? '#42dcb1' : '#a49ae4',
                                }}
                              />
                            </div>
                            <b>{frame.queues[selected]?.[i] ?? 0}</b>
                          </div>
                        ))}
                        <div className="muted tiny">Approaching vehicles within 65 m</div>
                        <div className="signal-footer">
                          <ShieldCheck size={14} />
                          <span>Minimum green · clearance · green cap</span>
                        </div>
                      </div>
                    </section>
                    <section className="panel trend-panel">
                      <div className="panel-heading">
                        <h2>Waiting time trend</h2>
                        <span className="tiny">SECONDS</span>
                      </div>
                      <div className="trend-chart">
                        <Chart data={chartHistory} compare />
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="purple" />
                          Fixed-time
                        </span>
                        <span>
                          <i />
                          Adaptive
                        </span>
                      </div>
                    </section>
                    <section className="insight-card">
                      <div>
                        <Sparkles size={17} />
                        <span>INTELLIGENCE SNAPSHOT</span>
                      </div>
                      <h3>
                        {a.time < 20
                          ? 'Every better journey begins with a baseline.'
                          : a.waiting < f.waiting
                            ? 'A different rhythm. Less waiting.'
                            : 'The experiment is still telling its story.'}
                      </h3>
                      <p>
                        {a.time < 20
                          ? 'Both controllers are receiving the exact same traffic demand. Watch the difference emerge.'
                          : `Adaptive: ${format(a.waiting)} s mean wait. Fixed-time: ${format(f.waiting)} s. Explore the full comparison, including fairness.`}
                      </p>
                      <button onClick={() => setTab(2)}>
                        Explore counterfactuals <ArrowRight size={15} />
                      </button>
                    </section>
                  </aside>
                </div>
              )}
              {tab === 0 && (
                <button className="lab-banner" onClick={() => setTab(2)}>
                  <div className="lab-symbol">
                    <GitCompareArrows size={24} />
                  </div>
                  <div>
                    <span className="tiny green">THE COUNTERFACTUAL TRAFFIC LAB</span>
                    <h3>What if the same city made a smarter decision?</h3>
                    <p>Compare two signal strategies. Same traffic. A measurable difference.</p>
                  </div>
                  <span className="button primary">
                    Open the lab <ArrowRight size={16} />
                  </span>
                </button>
              )}
              {tab === 1 && (
                <section className="panel settings">
                  <h2>Experiment configuration</h2>
                  <p>
                    Changes restart both matched runs. SUMO replays use their recorded
                    configuration; choose the browser model to calculate custom settings.
                  </p>
                  <fieldset disabled={source === 'sumo'}>
                    <label>
                      Network
                      <select
                        aria-label="Network"
                        value={config.junctions}
                        onChange={(e) => change({ junctions: Number(e.target.value) as 1 | 4 })}
                      >
                        <option value={1}>One junction · foundation</option>
                        <option value={4}>Four connected junctions</option>
                      </select>
                    </label>
                    <label>
                      Random seed
                      <input
                        aria-label="Random seed"
                        type="text"
                        inputMode="numeric"
                        value={seedDraft}
                        aria-invalid={draftSeed === null}
                        aria-describedby="seed-help"
                        onChange={(e) => setSeedDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && draftSeed !== null) {
                            e.preventDefault();
                            change({ seed: draftSeed });
                            setSeedDraft(String(draftSeed));
                          }
                        }}
                      />
                      <span
                        id="seed-help"
                        role={draftSeed === null ? 'alert' : undefined}
                        className={draftSeed === null ? 'field-error' : 'muted tiny'}
                      >
                        {draftSeed === null
                          ? 'Enter a whole number from 0 to 999999. The applied seed has not changed.'
                          : `Applied seed: ${config.seed}. Apply to restart both runs.`}
                      </span>
                      <button
                        type="button"
                        className="button subtle"
                        disabled={draftSeed === null || draftSeed === config.seed}
                        onClick={() => {
                          if (draftSeed !== null) {
                            change({ seed: draftSeed });
                            setSeedDraft(String(draftSeed));
                          }
                        }}
                      >
                        Apply seed
                      </button>
                    </label>
                    <label>
                      Traffic demand · {config.demand.toFixed(1)}×
                      <input
                        type="range"
                        min="0.2"
                        max="2"
                        step="0.1"
                        value={config.demand}
                        onChange={(e) => change({ demand: Number(e.target.value) })}
                      />
                    </label>
                  </fieldset>
                  <h3>Fixed controller parameters · read-only</h3>
                  <p>
                    These validated timings are fixed in this release. Network, seed and demand are
                    configurable above.
                  </p>
                  <div className="safety-grid">
                    <span>
                      <b>10 s</b>minimum green
                    </span>
                    <span>
                      <b>42 s</b>maximum adaptive green
                    </span>
                    <span>
                      <b>3 + 3 s</b>amber + all-red
                    </span>
                    <span>
                      <b>30 s</b>fixed green per axis
                    </span>
                  </div>
                </section>
              )}
              {tab === 2 && (
                <>
                  <div className="lab-intro">
                    <div>
                      <span className="tag green">
                        <Check size={12} /> MATCHED INPUTS
                      </span>
                      <h2>A fair test of a better idea.</h2>
                      <p>
                        Both worlds share a demand schedule and random seed. Only the signal
                        controller changes.
                      </p>
                    </div>
                    <button
                      className="button primary"
                      onClick={() => {
                        restart();
                        setPlaying(true);
                      }}
                    >
                      Restart paired experiment <Play size={14} />
                    </button>
                  </div>
                  <div className="paired-cities">
                    {(['fixed', 'adaptive'] as const).map((s) => (
                      <section className="panel" key={s}>
                        <div className="panel-heading">
                          <h2>
                            {s === 'fixed'
                              ? '01 / Conventional fixed-time'
                              : '02 / Adaptive intelligence'}
                          </h2>
                          <span className={`tag ${s === 'adaptive' ? 'green' : ''}`}>
                            {s === 'fixed' ? 'BASELINE' : 'COUNTERFACTUAL'}
                          </span>
                        </div>
                        <div className="mini-city">
                          <Suspense fallback={<div>Loading 3D…</div>}>
                            <City
                              playing={playing}
                              speed={speed}
                              frame={activeFrames[s]}
                              junctions={source === 'sumo' ? 4 : config.junctions}
                              selected={selected}
                              onSelect={setSelected}
                              heat={heat}
                              camera={camera}
                              compact
                            />
                          </Suspense>
                          <span className="mini-time">
                            {clock(activeFrames[s].time)} ·{' '}
                            {source === 'sumo' ? 'Recorded SUMO' : 'Live calculation'}
                          </span>
                        </div>
                      </section>
                    ))}
                  </div>
                  <div className="lab-transport">
                    <button className="button subtle" onClick={() => setPlaying(!playing)}>
                      {playing ? <Pause size={14} /> : <Play size={14} />}{' '}
                      {playing ? 'Pause both' : 'Play both'}
                    </button>
                    <span>Shared simulation clock · {clock(frame.time)}</span>
                    <label>
                      Speed{' '}
                      <select
                        aria-label="Lab playback speed"
                        value={speed}
                        onChange={(e) => setSpeed(Number(e.target.value))}
                      >
                        {PLAYBACK_SPEEDS.map((s) => (
                          <option key={s} value={s}>
                            {s}×
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="lab-results">
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Measured outcomes</h2>
                        <span className="tiny">
                          AT {clock(frame.time)} · {strategy.toUpperCase()} IN HEADER
                        </span>
                      </div>
                      <div className="table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Metric</th>
                              <th>Fixed-time</th>
                              <th>Adaptive</th>
                              <th>Difference</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              { name: 'Average waiting time', key: 'waiting', unit: 's' },
                              { name: 'Average delay', key: 'delay', unit: 's' },
                              { name: 'Current queue', key: 'queue', unit: 'veh' },
                              { name: 'Completed trips', key: 'throughput', unit: 'veh' },
                              { name: 'Total stops', key: 'stops', unit: '' },
                              { name: 'Worst accumulated wait', key: 'worstWait', unit: 's' },
                              { name: 'Approach wait equality', key: 'fairness', unit: '' },
                            ].map((row) => {
                              const fv = f[row.key as keyof Metrics] as number,
                                av = a[row.key as keyof Metrics] as number;
                              return (
                                <tr key={row.key}>
                                  <td>{row.name}</td>
                                  <td>
                                    {format(fv)} {row.unit}
                                  </td>
                                  <td className="green">
                                    {format(av)} {row.unit}
                                  </td>
                                  <td>
                                    {row.key === 'fairness' || row.key === 'throughput' ? (
                                      `${av >= fv ? '+' : ''}${format(av - fv)}`
                                    ) : (
                                      <Delta value={improvement(fv, av)} />
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                      <p className="table-note">
                        Lower is better for waiting, delay, queues and stops. Equality is Jain’s
                        index of mean approach waits (1 = equal); equal waiting can still be poor
                        service.
                      </p>
                    </section>
                    <section className="panel">
                      <div className="panel-heading">
                        <h2>Same arrivals. Different outcomes.</h2>
                      </div>
                      <div className="comparison-chart">
                        <Chart data={chartHistory} compare />
                      </div>
                      <div className="chart-legend">
                        <span>
                          <i className="purple" />
                          Fixed-time
                        </span>
                        <span>
                          <i />
                          Adaptive
                        </span>
                      </div>
                    </section>
                  </div>
                  <section className="panel evaluation">
                    <div>
                      <span className="tag green">BROWSER MODEL ONLY · NEW CALCULATION</span>
                      <h2>Go beyond a single seed.</h2>
                      <p>
                        Run five paired browser experiments (11, 22, 33, 44, 55), each with 5
                        minutes of arrivals and 5 minutes of clearance. Regressions are retained.
                      </p>
                    </div>
                    <button className="button primary" disabled={busy} onClick={runBatch}>
                      <FlaskConical size={16} />
                      {busy ? 'Calculating…' : 'Run 5-seed evaluation'}
                    </button>
                    {batch && (
                      <div className="batch-results">
                        <table>
                          <thead>
                            <tr>
                              <th>Seed</th>
                              <th>Fixed wait</th>
                              <th>Adaptive wait</th>
                              <th>Change</th>
                              <th>Unfinished F / A</th>
                            </tr>
                          </thead>
                          <tbody>
                            {batch.map((r) => (
                              <tr key={r.seed}>
                                <td>{r.seed}</td>
                                <td>{format(r.fixed.metrics.waiting)} s</td>
                                <td>{format(r.adaptive.metrics.waiting)} s</td>
                                <td>
                                  <Delta
                                    value={improvement(
                                      r.fixed.metrics.waiting,
                                      r.adaptive.metrics.waiting,
                                    )}
                                  />
                                </td>
                                <td>
                                  {r.fixed.metrics.unfinished} / {r.adaptive.metrics.unfinished}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        <button
                          className="button subtle"
                          onClick={() =>
                            download(
                              { engine: 'browser', config, runs: batch },
                              'urbantwin-five-seeds.json',
                            )
                          }
                        >
                          <Download size={14} /> Download full batch
                        </button>
                      </div>
                    )}
                  </section>
                </>
              )}
              {tab === 3 && (
                <>
                  <div className="insights-grid">
                    {notes.map((n, i) => (
                      <section className="panel insight-detail" key={n.title}>
                        <span className="insight-number">
                          0{i + 1} <Sparkles size={18} />
                        </span>
                        <h2>{n.title}</h2>
                        <p>{n.body}</p>
                        <span className="tag">
                          Evidence · {clock(frame.time)} · {source}
                        </span>
                      </section>
                    ))}
                  </div>
                  <section className="panel assistant">
                    <div className="assistant-title">
                      <div className="brand-icon">
                        <Sparkles size={23} />
                      </div>
                      <div>
                        <h2>Your traffic intelligence assistant</h2>
                        <p>Local, rules-based analysis grounded in the current experiment.</p>
                      </div>
                    </div>
                    <div className="prompt-chips">
                      {[
                        'Which intersection is most congested right now?',
                        'Which intersection had the most waiting over the run?',
                        'Explain the comparison',
                        'Which approach waits longest?',
                        'What should I test next?',
                      ].map((q) => (
                        <button onClick={() => setQuestion(q)} key={q}>
                          {q}
                        </button>
                      ))}
                    </div>
                    {answer && (
                      <div className="assistant-answer" role="status" aria-live="polite">
                        <Sparkles size={18} />
                        <p>{answer}</p>
                      </div>
                    )}
                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        ask();
                      }}
                    >
                      <input
                        aria-label="Ask traffic assistant"
                        placeholder="Ask about waiting times, fairness, or the next experiment…"
                        value={question}
                        onChange={(e) => setQuestion(e.target.value)}
                        maxLength={500}
                      />
                      <button className="button primary" disabled={!question.trim()} type="submit">
                        <Send size={16} /> Ask
                      </button>
                    </form>
                    <small>
                      This assistant supports current junction demand, cumulative junction waiting,
                      comparison, stops, fairness and intervention questions. It does not access
                      real traffic feeds or control real signals.
                    </small>
                  </section>
                </>
              )}
              {tab === 4 && (
                <div className="methodology">
                  <section className="panel methodology-hero">
                    <span className="tag green">SIMULATE THE CITY. SOLVE THE CONGESTION.</span>
                    <h2>A digital twin with an honest evidence trail.</h2>
                    <p>
                      UrbanTwin AI is a Bengaluru-inspired synthetic traffic laboratory. Its
                      signature counterfactual comparison isolates the signal strategy while holding
                      demand constant. It is a research demonstration, not a calibrated model of
                      Bengaluru or a deployable road-safety controller.
                    </p>
                  </section>
                  <div className="method-grid">
                    {[
                      {
                        title: '01 · Two clearly separated engines',
                        body: 'Live mode calculates a deterministic, single-lane, straight-through browser model at 0.5-second steps. Recorded mode replays Eclipse SUMO 1.28.0 positions and metrics from a Python/TraCI pipeline. Browser results and SUMO results are never pooled.',
                      },
                      {
                        title: '02 · Matched counterfactuals',
                        body: 'Fixed-time and adaptive controllers use the same route file, scheduled arrivals, seed, road geometry and incident. Five seeds per scenario expose variability. Demand is generated for 300 seconds, with a 600-second total observation window; unfinished trips remain visible.',
                      },
                      {
                        title: '03 · Transparent adaptive control',
                        body: 'A queue-pressure heuristic weights approaching demand and waiting age. Signals have a 10-second minimum, 42-second maximum, 3-second amber and 3-second all-red interval. Fixed control holds each green for 30 seconds. This is an explainable algorithm, not trained reinforcement learning.',
                      },
                      {
                        title: '04 · Metrics that include the queue',
                        body: 'Mean waiting includes released vehicles, including those waiting to enter. Delay measures time lost relative to free-flow travel. Throughput counts completed trips; stops count transitions to standstill. Worst wait is accumulated per vehicle. Approach fairness reports Jain’s index over average waits.',
                      },
                      {
                        title: '05 · Known limits',
                        body: 'The district has four connected junctions and straight-through routes, without turning movements, pedestrians, buses, motorcycles or calibrated demand. The browser engine has immediate acceleration and is illustrative. SUMO is the more realistic evaluation engine; neither model supports claims about actual Bengaluru travel times.',
                      },
                      {
                        title: '06 · Reproduce and extend',
                        body: 'Source includes locked JavaScript dependencies, pinned SUMO packages, scenario generation, controller tests, paired evaluation scripts and a demonstration guide. Export results at any time. No API key, database or paid model is required for the essential product.',
                      },
                    ].map((c) => (
                      <section className="panel method-card" key={c.title}>
                        <h2>{c.title}</h2>
                        <p>{c.body}</p>
                      </section>
                    ))}
                  </div>
                  <section
                    className="panel evaluation sumo-evidence"
                    aria-label="SUMO-only evaluation"
                  >
                    <span className="tag">SUMO ONLY · PRERECORDED EVIDENCE</span>
                    <h2>Recorded SUMO evaluation</h2>
                    <p>
                      These percentages belong to Eclipse SUMO, not the live browser model or its
                      five-seed batch. Compare controllers within each engine; do not pool the two
                      engines.
                    </p>
                    {sumo ? (
                      <>
                        <p>
                          Eclipse SUMO {sumo.version} · {sumo.seeds?.length} paired seeds per
                          scenario · 600 seconds per run. Positive percentages mean less waiting;
                          negative values are regressions.
                        </p>
                        <div className="table-scroll">
                          <table>
                            <thead>
                              <tr>
                                <th>Scenario</th>
                                <th>Mean wait change</th>
                                <th>95% t interval</th>
                                <th>Runs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {sumo.results.map((r) => (
                                <tr key={r.scenario}>
                                  <td>{labels[r.scenario as Scenario]}</td>
                                  <td>{format(r.waitImprovementMean)}%</td>
                                  <td>{r.waitImprovement95CI.map(format).join(' to ')}%</td>
                                  <td>{r.runs.length}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                        <button
                          className="button subtle"
                          onClick={() => download(sumo, 'sumo-evaluation.json')}
                        >
                          <Download size={15} /> Download SUMO evidence
                        </button>
                      </>
                    ) : (
                      <p>
                        SUMO evaluation data is not available in this build. Browser experiments can
                        still be calculated in the lab.
                      </p>
                    )}
                  </section>
                  <section className="panel method-card">
                    <h2>Competition readiness</h2>
                    <p>
                      Prepared for Zeta Innovate 2026. November 1, 2026 is the user-supplied target
                      date; an official public Candidate Guide could not be located during this
                      build. Eligibility, submission format and official deadlines still need
                      verification against that guide.
                    </p>
                    <a
                      className="text-link"
                      href="https://github.com/IntelliCoder-AI/urbantwin-ai"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Explore the source and submission package <ArrowUpRight size={14} />
                    </a>
                  </section>
                </div>
              )}
            </>
          )}
          <footer>
            <span>
              <i className="dot" />{' '}
              {source === 'sumo' ? 'PRERECORDED SUMO EXPERIMENT' : 'LIVE SYNTHETIC SIMULATION'}{' '}
              <span className="footer-separator">/</span> No real-world traffic data
            </span>
            <span className="footer-links">
              <a
                href="https://github.com/IntelliCoder-AI/urbantwin-ai"
                target="_blank"
                rel="noreferrer"
              >
                GitHub source
              </a>
              <a
                href="https://github.com/IntelliCoder-AI/urbantwin-ai/issues"
                target="_blank"
                rel="noreferrer"
              >
                Feedback / report an issue
              </a>
            </span>
          </footer>
        </div>
      </main>
    </div>
  );
}
