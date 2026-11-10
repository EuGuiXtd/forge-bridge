// Pure functions: merge two daily calendars into a year grid and compute stats.

const DAY = 86_400_000;

/** @param {Date} d */
export const iso = (d) => d.toISOString().slice(0, 10);

/**
 * Build the grid GitHub-style: columns are weeks starting on Sunday, the last column contains `today`.
 * @param {Map<string, number>} gitlab
 * @param {Map<string, number>} github
 * @param {Date} today  (UTC date)
 * @returns {{date: string, gitlab: number, github: number, total: number, future: boolean}[]}
 */
export function buildYear(gitlab, github, today) {
  const end = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
  const start = new Date(end.getTime() - (52 * 7 + end.getUTCDay()) * DAY);
  const lastCell = new Date(end.getTime() + (6 - end.getUTCDay()) * DAY);
  const days = [];
  for (let t = start.getTime(); t <= lastCell.getTime(); t += DAY) {
    const date = iso(new Date(t));
    const gl = gitlab.get(date) ?? 0;
    const gh = github.get(date) ?? 0;
    days.push({ date, gitlab: gl, github: gh, total: gl + gh, future: t > end.getTime() });
  }
  return days;
}

/** @param {ReturnType<typeof buildYear>} days */
export function computeStats(days) {
  const past = days.filter((d) => !d.future);
  let longest = 0;
  let run = 0;
  for (const d of past) {
    run = d.total > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  let current = 0;
  for (let i = past.length - 1; i >= 0 && past[i].total > 0; i--) current++;
  const months = new Map();
  for (const d of past) months.set(d.date.slice(0, 7), (months.get(d.date.slice(0, 7)) ?? 0) + d.total);
  const [busiestMonth, busiestMonthTotal] = [...months].sort((a, b) => b[1] - a[1])[0] ?? ['', 0];
  return {
    total: past.reduce((s, d) => s + d.total, 0),
    gitlab: past.reduce((s, d) => s + d.gitlab, 0),
    github: past.reduce((s, d) => s + d.github, 0),
    activeDays: past.filter((d) => d.total > 0).length,
    longestStreak: longest,
    currentStreak: current,
    busiestMonth,
    busiestMonthTotal,
  };
}

/**
 * Intensity level 0-4 using quartiles of the non-zero days, so a heavy year and a light year
 * both use the full color range.
 * @param {ReturnType<typeof buildYear>} days
 */
export function levelFn(days) {
  const nz = days.filter((d) => d.total > 0).map((d) => d.total).sort((a, b) => a - b);
  const q = (p) => nz[Math.floor(p * (nz.length - 1))] ?? 0;
  const [q1, q2, q3] = [q(0.25), q(0.5), q(0.75)];
  return (/** @type {number} */ n) => (n <= 0 ? 0 : n <= q1 ? 1 : n <= q2 ? 2 : n <= q3 ? 3 : 4);
}
