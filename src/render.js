// SVG renderers. No external fonts or images: the files are self-contained so they never break.
import { levelFn } from './merge.js';

export const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const fmt = (n) => n.toLocaleString('en-US');
const MONO = `ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace`;
const SANS = `-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif`;

const THEMES = {
  dark: {
    bg: '#0d1117', fg: '#e6edf3', muted: '#8b949e', empty: '#161b22',
    gitlab: ['#161b22', '#5a2a10', '#9a4416', '#e0662a', '#ff9a5c'],
    github: ['#161b22', '#0e4429', '#006d32', '#26a641', '#39d353'],
  },
  light: {
    bg: '#ffffff', fg: '#1f2328', muted: '#59636e', empty: '#ebedf0',
    gitlab: ['#ebedf0', '#fdd3b8', '#fca56f', '#ef7a35', '#c4501a'],
    github: ['#ebedf0', '#9be9a8', '#40c463', '#30a14e', '#216e39'],
  },
};

/**
 * Unified heatmap: each day is colored by its dominant source (GitLab orange / GitHub green),
 * intensity by the combined total.
 * @param {ReturnType<import('./merge.js').buildYear>} days
 * @param {ReturnType<import('./merge.js').computeStats>} stats
 * @param {{theme?: 'dark'|'light', gitlabUser: string, githubUser: string}} opts
 */
export function renderHeatmap(days, stats, { theme = 'dark', gitlabUser, githubUser }) {
  const t = THEMES[theme];
  const level = levelFn(days);
  const cell = 11, step = 14, left = 34, top = 44;
  const weeks = Math.ceil(days.length / 7);
  const width = left + weeks * step + 10;
  const height = top + 7 * step + 40;
  const rects = [];
  const months = [];
  let lastMonth = '';
  days.forEach((d, i) => {
    const col = Math.floor(i / 7), row = i % 7;
    const x = left + col * step, y = top + row * step;
    if (row === 0 && d.date.slice(5, 7) !== lastMonth && col < weeks - 1) {
      lastMonth = d.date.slice(5, 7);
      const name = new Date(d.date + 'T00:00:00Z').toLocaleString('en-US', { month: 'short', timeZone: 'UTC' });
      months.push(`<text x="${x}" y="${top - 6}" class="m">${name}</text>`);
    }
    if (d.future) return;
    const src = d.github > d.gitlab ? 'github' : 'gitlab';
    const fill = d.total ? t[src][level(d.total)] : t.empty;
    const tip = `${d.date}: ${d.gitlab} GitLab · ${d.github} GitHub`;
    rects.push(`<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="2" fill="${fill}"><title>${tip}</title></rect>`);
  });
  const legendY = top + 7 * step + 22;
  const sw = (x, color, label) =>
    `<rect x="${x}" y="${legendY - 9}" width="${cell}" height="${cell}" rx="2" fill="${color}"/><text x="${x + 16}" y="${legendY}" class="m">${label}</text>`;
  const title = `${fmt(stats.total)} contributions in the last year`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="t d">
<title id="t">${esc(title)}</title>
<desc id="d">${esc(`${fmt(stats.gitlab)} on GitLab and ${fmt(stats.github)} on GitHub (daily counts only, private work included); ${stats.activeDays} active days.`)}</desc>
<style>text{font-family:${SANS};fill:${t.muted};font-size:10px}.h{fill:${t.fg};font-size:14px;font-weight:600}</style>
<rect width="100%" height="100%" rx="8" fill="${t.bg}"/>
<text x="${left}" y="22" class="h">${esc(title)}</text>
<text x="${width - 10}" y="22" text-anchor="end">${stats.activeDays} active days · longest streak ${stats.longestStreak}d</text>
${months.join('')}
<text x="4" y="${top + 1 * step + 9}">Mon</text><text x="4" y="${top + 3 * step + 9}">Wed</text><text x="4" y="${top + 5 * step + 9}">Fri</text>
${rects.join('')}
${sw(left, t.gitlab[3], `GitLab · ${esc(gitlabUser)} · ${fmt(stats.gitlab)}`)}
${sw(left + 220, t.github[3], `GitHub · ${esc(githubUser)} · ${fmt(stats.github)}`)}
<text x="${width - 10}" y="${legendY}" text-anchor="end">counts only · verify on both profiles</text>
</svg>
`;
}

/**
 * Terminal card with a typing animation. The base (non-animated) state shows every line, so
 * viewers without SMIL support still see the full content.
 * @param {{title: string, lines: {kind: 'cmd'|'out'|'ok'|'dim', text: string}[]}} card
 */
export function renderTerminal({ title, lines }) {
  const width = 820, lh = 22, top = 52, charW = 8.4;
  const height = top + (lines.length + 1) * lh + 10;
  const colors = { cmd: '#e6edf3', out: '#c9d1d9', ok: '#7ee787', dim: '#8b949e' };
  // timeline: commands type at ~28 chars/s, outputs appear after a short pause
  let t = 0.4;
  const timed = lines.map((l) => {
    const dur = l.kind === 'cmd' ? Math.max(0.3, l.text.length / 28) : 0.05;
    const start = t;
    t += dur + (l.kind === 'cmd' ? 0.35 : 0.12);
    return { ...l, start, dur };
  });
  const total = t + 0.5;
  const k = (x) => Math.min(1, x / total).toFixed(4);
  const body = timed
    .map((l, i) => {
      const y = top + i * lh;
      const prompt = l.kind === 'cmd' ? `<tspan fill="#7ee787">$ </tspan>` : '';
      const fullW = (l.text.length + 2) * charW + 10;
      return `<clipPath id="c${i}"><rect x="18" y="${y - 16}" height="${lh}" width="${fullW}"><animate attributeName="width" dur="${total.toFixed(2)}s" fill="freeze" values="0;0;${fullW};${fullW}" keyTimes="0;${k(l.start)};${k(l.start + l.dur)};1"/></rect></clipPath>
<text x="20" y="${y}" fill="${colors[l.kind]}" clip-path="url(#c${i})">${prompt}${esc(l.text)}</text>`;
    })
    .join('\n');
  const cy = top + lines.length * lh;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="tt">
<title id="tt">${esc(lines.map((l) => (l.kind === 'cmd' ? '$ ' : '') + l.text).join('\n'))}</title>
<style>text{font-family:${MONO};font-size:14px;white-space:pre}</style>
<rect width="100%" height="100%" rx="10" fill="#0d1117" stroke="#30363d"/>
<circle cx="22" cy="18" r="6" fill="#ff5f57"/><circle cx="42" cy="18" r="6" fill="#febc2e"/><circle cx="62" cy="18" r="6" fill="#28c840"/>
<text x="${width / 2}" y="22" text-anchor="middle" fill="#8b949e" style="font-size:12px">${esc(title)}</text>
${body}
<text x="20" y="${cy}" fill="#7ee787">$ <tspan fill="#e6edf3">▌<animate attributeName="opacity" values="1;0;1" dur="1s" repeatCount="indefinite"/></tspan></text>
</svg>
`;
}

/** Right-pad a label with dots so values line up in a monospace column. */
export const dotted = (label, value, col = 40) => `${label} ${'.'.repeat(Math.max(2, col - label.length))} ${value}`;
