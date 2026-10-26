import { describe, expect, it } from 'vitest';
import { answerTrafficQuestion, type AssistantContext } from '../src/sim/assistant';
import { DEFAULT_CONFIG, Simulation } from '../src/sim/engine';
import { parseSeed } from '../src/sim/validation';

function context(): AssistantContext {
  const fixed = new Simulation(DEFAULT_CONFIG, 'fixed').frame();
  const adaptive = new Simulation(DEFAULT_CONFIG, 'adaptive').frame();
  adaptive.time = fixed.time = 120;
  adaptive.queues = [
    [1, 2],
    [9, 4],
    [3, 2],
    [0, 0],
  ];
  return { fixed, adaptive, scenario: 'rush', strategy: 'adaptive', source: 'browser' };
}
describe('grounded assistant', () => {
  it('names the busiest junction with measured axes and source', () => {
    const answer = answerTrafficQuestion(
      'Which intersection is most congested in rush hour and why?',
      context(),
    );
    expect(answer).toContain('junction 02 (100 Feet Road)');
    expect(answer).toContain('13 vehicles');
    expect(answer).toContain('East–West 9, North–South 4');
    expect(answer).toContain('including moving traffic');
    expect(answer).toContain('02:00');
  });
  it.each(['best pizza recipe in Naples?', 'Compare pizza with pasta', 'What is the worst movie?'])(
    'refuses off-topic question %s instead of reporting metrics',
    (question) => {
      expect(answerTrafficQuestion(question, context())).toMatch(
        /^I can only answer questions about this simulation/,
      );
    },
  );
  it('reports ties without arbitrarily picking a winner', () => {
    const c = context();
    c.adaptive.queues[2] = [7, 6];
    const answer = answerTrafficQuestion('Which junction is most congested?', c);
    expect(answer).toContain('junction 02 (100 Feet Road) and junction 03 (HAL Junction) tie');
  });
  it('does not invent congestion after traffic has cleared', () => {
    const c = context();
    c.adaptive.queues = [
      [0, 0],
      [0, 0],
      [0, 0],
      [0, 0],
    ];
    expect(answerTrafficQuestion('Which junction is most congested?', c)).toContain(
      'no current congestion leader',
    );
  });
  it('does not answer for a different scenario', () => {
    const c = context();
    c.scenario = 'incident';
    expect(answerTrafficQuestion('Which junction is most congested in rush hour?', c)).toContain(
      'Select rush hour',
    );
  });
  it('uses the displayed fixed strategy and handles approach ties', () => {
    const c = context();
    c.strategy = 'fixed';
    c.fixed.metrics.approachWait = [14, 14, 3, 0];
    const answer = answerTrafficQuestion('Which approach waits longest?', c);
    expect(answer).toContain('eastbound and westbound');
    expect(answer).toContain('14.0 s');
    expect(answer).toContain('fixed control');
  });
  it('discloses more stops even when waiting improves', () => {
    const c = context();
    c.fixed.metrics.waiting = 79.2;
    c.adaptive.metrics.waiting = 46.6;
    c.fixed.metrics.stops = 1897;
    c.adaptive.metrics.stops = 2272;
    const answer = answerTrafficQuestion('Explain the comparison', c);
    expect(answer).toContain('adaptive 2272, fixed-time 1897');
    expect(answer).toContain('more stops');
    expect(answer).toContain('lower than fixed-time');
  });
});
describe('seed validation', () => {
  it.each(['abc', '-1', '', '1.5', '1e3', '1000000', ' 42 ', 'Infinity'])(
    'rejects %j without coercion',
    (draft) => expect(parseSeed(draft)).toBeNull(),
  );
  it.each([
    ['0', 0],
    ['42', 42],
    ['999999', 999999],
  ])('accepts %s', (draft, seed) => expect(parseSeed(draft as string)).toBe(seed));
});
