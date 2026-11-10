#!/usr/bin/env node
// Usage: GITHUB_TOKEN=... node src/cli.js [config.json]
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fetchGitHubCalendar, fetchGitLabCalendar } from './sources.js';
import { buildYear, computeStats } from './merge.js';
import { dotted, renderHeatmap, renderTerminal } from './render.js';

const configPath = process.argv[2] ?? 'forge-bridge.config.json';
const cfg = JSON.parse(await readFile(configPath, 'utf8'));
const out = cfg.out ?? 'out';

const [gitlab, github] = await Promise.all([
  fetchGitLabCalendar(cfg.gitlab.user, cfg.gitlab.baseUrl),
  fetchGitHubCalendar(cfg.github.user, process.env.GITHUB_TOKEN),
]);
const days = buildYear(gitlab, github, new Date());
const stats = computeStats(days);
const fmt = (n) => n.toLocaleString('en-US');

const lines = [
  { kind: 'cmd', text: 'whoami' },
  { kind: 'out', text: cfg.terminal.whoami },
  { kind: 'cmd', text: 'cat impact.log' },
  ...cfg.terminal.impact.map(([label, value]) => ({ kind: 'ok', text: '✓ ' + dotted(label, value) })),
  { kind: 'cmd', text: 'forge-bridge stats --last 12mo' },
  {
    kind: 'out',
    text: `${fmt(stats.total)} contributions · ${stats.activeDays} active days · longest streak ${stats.longestStreak}d`,
  },
  { kind: 'dim', text: `source: gitlab.com/${cfg.gitlab.user} (private, counts only) + github.com/${cfg.github.user}` },
];

await mkdir(out, { recursive: true });
const opts = { gitlabUser: cfg.gitlab.user, githubUser: cfg.github.user };
await Promise.all([
  writeFile(join(out, 'terminal.svg'), renderTerminal({ title: cfg.terminal.title, lines })),
  writeFile(join(out, 'heatmap-dark.svg'), renderHeatmap(days, stats, { ...opts, theme: 'dark' })),
  writeFile(join(out, 'heatmap-light.svg'), renderHeatmap(days, stats, { ...opts, theme: 'light' })),
  writeFile(join(out, 'stats.json'), JSON.stringify({ generatedAt: new Date().toISOString(), ...stats }, null, 2) + '\n'),
]);
console.log(`forge-bridge: ${fmt(stats.total)} contributions (${fmt(stats.gitlab)} GitLab + ${fmt(stats.github)} GitHub), ${stats.activeDays} active days → ${out}/`);
