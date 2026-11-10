import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildYear, computeStats, levelFn } from '../src/merge.js';
import { esc, renderHeatmap, renderTerminal } from '../src/render.js';

const today = new Date('2026-11-10T12:00:00Z'); // a Tuesday

test('grid starts on a Sunday, ends on Saturday and marks days after today as future', () => {
  const days = buildYear(new Map(), new Map(), today);
  assert.equal(days.length % 7, 0);
  assert.equal(new Date(days[0].date + 'T00:00:00Z').getUTCDay(), 0);
  assert.equal(days.at(-1).date, '2026-11-14');
  assert.equal(days.find((d) => d.date === '2026-11-10').future, false);
  assert.equal(days.find((d) => d.date === '2026-11-11').future, true);
});

test('merges both sources per day', () => {
  const days = buildYear(new Map([['2026-11-09', 3]]), new Map([['2026-11-09', 2]]), today);
  const d = days.find((x) => x.date === '2026-11-09');
  assert.deepEqual([d.gitlab, d.github, d.total], [3, 2, 5]);
});

test('stats: totals, active days and streaks', () => {
  const gl = new Map([['2026-11-01', 1], ['2026-11-02', 1], ['2026-11-03', 1], ['2026-11-09', 4], ['2026-11-10', 2]]);
  const s = computeStats(buildYear(gl, new Map([['2026-11-05', 7]]), today));
  assert.equal(s.total, 16);
  assert.equal(s.gitlab, 9);
  assert.equal(s.github, 7);
  assert.equal(s.activeDays, 6);
  assert.equal(s.longestStreak, 3);
  assert.equal(s.currentStreak, 2);
  assert.equal(s.busiestMonth, '2026-11');
});

test('future days never count, even with data', () => {
  const s = computeStats(buildYear(new Map([['2026-11-12', 99]]), new Map(), today));
  assert.equal(s.total, 0);
});

test('levels: zero stays 0, max reaches 4', () => {
  const days = buildYear(new Map([['2026-11-01', 1], ['2026-11-02', 5], ['2026-11-03', 10], ['2026-11-04', 50]]), new Map(), today);
  const level = levelFn(days);
  assert.equal(level(0), 0);
  assert.equal(level(1), 1);
  assert.equal(level(50), 4);
});

test('renderers escape user text and produce SVG', () => {
  assert.equal(esc('<a & "b">'), '&lt;a &amp; &quot;b&quot;&gt;');
  const days = buildYear(new Map(), new Map(), today);
  const svg = renderHeatmap(days, computeStats(days), { gitlabUser: 'x<y', githubUser: 'z' });
  assert.match(svg, /^<svg/);
  assert.ok(!svg.includes('x<y'));
  const term = renderTerminal({ title: 't', lines: [{ kind: 'cmd', text: 'echo <hi>' }] });
  assert.ok(term.includes('echo &lt;hi&gt;'));
});
