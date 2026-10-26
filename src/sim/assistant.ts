import { NAMES, improvement, type Frame, type Scenario, type Strategy } from './engine';

export type AssistantContext = {
  fixed: Frame;
  adaptive: Frame;
  scenario: Scenario;
  strategy: Strategy;
  source: 'browser' | 'sumo';
};
const scenarios: Record<Scenario, string> = {
  normal: 'normal traffic',
  rush: 'rush hour',
  incident: 'road incident',
};
const fmt = (n: number) => n.toFixed(1);
const junctionName = (i: number) => `junction ${String(i + 1).padStart(2, '0')} (${NAMES[i]})`;

/** Deliberately bounded local intents. Unsupported questions never fall through to a metric template. */
export function answerTrafficQuestion(question: string, context: AssistantContext): string {
  const q = question.trim().toLowerCase();
  const inDomain =
    /\b(traffic|simulation|signal|signals|junction|intersection|congestion|congested|waiting|wait|queue|queues|throughput|stops|fairness|adaptive|fixed|delay|approach|approaches)\b/.test(
      q,
    ) || /^(explain the comparison|what should i test next)\??$/.test(q);
  const junction = /\b(junction|intersection|congested|congestion|bottleneck)\b/.test(q);
  const fairness = /\b(fairness|fair|starvation|starving|approach|approaches|longest|worst)\b/.test(
    q,
  );
  const stops = /\b(stops|stopping|stop.start|trade.?offs?)\b/.test(q);
  const comparison =
    /\b(comparison|compare|waiting|delay|throughput|adaptive|fixed.time|optimization)\b/.test(q);
  const intervention =
    (/\b(incident|intervention|signal|signals|traffic|simulation)\b/.test(q) &&
      /\b(why|suggest|reduce|improve|test|next|explain|recommend)\b/.test(q)) ||
    /^what should i test next\??$/.test(q);
  if (!inDomain || (!junction && !fairness && !stops && !comparison && !intervention)) {
    return 'I can only answer questions about this simulation. Ask about the most congested intersection, approach waiting times, fixed-time versus adaptive results, vehicle stops, or an intervention to test.';
  }
  const { fixed, adaptive, strategy, source, scenario } = context;
  const frame = context[strategy];
  const time = `${String(Math.floor(frame.time / 60)).padStart(2, '0')}:${String(Math.floor(frame.time % 60)).padStart(2, '0')}`;
  const evidence = `Evidence: ${source === 'sumo' ? 'recorded SUMO' : 'live browser model'}, ${scenarios[scenario]}, ${strategy} control, ${time}.`;
  const requested = /\brush[ -]?hour\b/.test(q)
    ? 'rush'
    : /\bnormal traffic\b/.test(q)
      ? 'normal'
      : /\bincident\b/.test(q)
        ? 'incident'
        : null;
  if (requested && requested !== scenario) {
    return `The current scenario is ${scenarios[scenario]}. Select ${scenarios[requested]} in Traffic scenario to answer this question using that experiment. ${evidence}`;
  }
  let answer: string;
  if (junction) {
    const totals = frame.queues.map(([ew, ns]) => ew + ns);
    const max = Math.max(0, ...totals);
    if (max === 0) {
      answer =
        'No junction currently has approaching vehicles in its 65 m detection zone, so there is no current congestion leader. This snapshot cannot identify the worst junction earlier in the run.';
    } else {
      const winners = totals.flatMap((v, i) => (v === max ? [i] : []));
      answer = `${winners.map(junctionName).join(' and ')} ${winners.length > 1 ? 'tie for' : 'has'} the highest approaching demand: ${max} vehicles per junction. `;
      answer += winners
        .map((i) => {
          const [ew, ns] = frame.queues[i];
          const s = frame.signals[i];
          const phase =
            s.phase === 'clearance'
              ? 'all-red clearance'
              : `${s.axis === 0 ? 'East–West' : 'North–South'} ${s.phase}`;
          return `${junctionName(i)}: East–West ${ew}, North–South ${ns}; signal ${phase} (${fmt(s.elapsed)} s elapsed).`;
        })
        .join(' ');
      answer +=
        ' This ranking uses approaching vehicles within 65 m, including moving traffic, as a congestion proxy. It shows where demand is concentrated now; it does not establish a causal explanation or a whole-run ranking.';
      if (scenario === 'incident' && frame.time >= 90 && frame.time < 180)
        answer +=
          ' The configured incident currently restricts eastbound traffic at junction 01; signals cannot remove that obstruction.';
    }
  } else if (fairness) {
    const waits = frame.metrics.approachWait;
    const max = Math.max(0, ...waits);
    const names = ['eastbound', 'westbound', 'southbound', 'northbound'];
    answer =
      max === 0
        ? 'No accumulated approach waiting has been measured yet.'
        : `The ${waits.flatMap((v, i) => (v === max ? [names[i]] : [])).join(' and ')} approaches have the highest mean wait: ${fmt(max)} s, aggregated across the network. The worst individual accumulated wait is ${fmt(frame.metrics.worstWait)} s. Approach wait equality is ${frame.metrics.fairness.toFixed(3)} (1 means equal, not necessarily fast).`;
  } else if (stops || comparison) {
    const f = fixed.metrics,
      a = adaptive.metrics;
    const pct = improvement(f.waiting, a.waiting);
    answer = `Adaptive mean waiting is ${fmt(a.waiting)} s versus ${fmt(f.waiting)} s for fixed-time${pct === null ? '; there is no nonzero waiting baseline yet' : `: ${fmt(Math.abs(pct))}% ${pct >= 0 ? 'lower' : 'higher'} than fixed-time`}. Stops: adaptive ${a.stops}, fixed-time ${f.stops}. `;
    answer +=
      a.stops > f.stops
        ? 'Adaptive makes more stops in this run; lower waiting does not imply improvement on every measure. '
        : 'Stops and waiting are separate measures; compare both before choosing a strategy. ';
    answer += `Completed trips: adaptive ${a.throughput}, fixed-time ${f.throughput}. ${frame.time < 600 ? 'This is a partial-run snapshot.' : 'This run is complete.'} Repeat matched seeds before generalizing.`;
  } else {
    answer =
      scenario === 'incident'
        ? 'The synthetic incident restricts eastbound traffic at junction 01 from 01:30 to 03:00. Compare queues before, during and after that window; changing signals cannot remove the obstruction.'
        : 'Test a 20% reduction in traffic demand in Control center, then repeat the five matched seeds. Compare waiting, stops and worst-case wait; this tests demand sensitivity, not a proven real-world intervention.';
  }
  return `${answer} ${evidence} This is local rules-based analysis of synthetic traffic.`;
}
