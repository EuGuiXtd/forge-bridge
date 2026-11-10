// Data sources. Both only read PUBLIC, aggregate data:
// - GitLab: the profile calendar (counts per day). Private-project contributions show up there
//   only when the user enables "Include private contributions on my profile" - no project names,
//   no code, no commit messages. No token needed.
// - GitHub: the contributions calendar via GraphQL (needs any token, e.g. the Actions GITHUB_TOKEN).

/**
 * @param {string} user
 * @param {string} [baseUrl]
 * @returns {Promise<Map<string, number>>} YYYY-MM-DD -> count
 */
export async function fetchGitLabCalendar(user, baseUrl = 'https://gitlab.com') {
  const res = await fetch(`${baseUrl}/users/${encodeURIComponent(user)}/calendar.json`, {
    headers: { 'User-Agent': 'forge-bridge' },
  });
  if (!res.ok) throw new Error(`GitLab calendar: HTTP ${res.status}`);
  const data = await res.json();
  return new Map(Object.entries(data).map(([d, n]) => [d, Number(n) || 0]));
}

/**
 * @param {string} user
 * @param {string | undefined} token
 * @returns {Promise<Map<string, number>>}
 */
export async function fetchGitHubCalendar(user, token) {
  if (!token) {
    console.warn('forge-bridge: GITHUB_TOKEN not set, skipping GitHub contributions');
    return new Map();
  }
  const query = `query($login:String!){user(login:$login){contributionsCollection{contributionCalendar{weeks{contributionDays{date contributionCount}}}}}}`;
  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'User-Agent': 'forge-bridge', 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { login: user } }),
  });
  if (!res.ok) throw new Error(`GitHub GraphQL: HTTP ${res.status}`);
  const json = await res.json();
  const weeks = json?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks) throw new Error(`GitHub GraphQL: unexpected response ${JSON.stringify(json.errors ?? json).slice(0, 200)}`);
  const map = new Map();
  for (const w of weeks) for (const d of w.contributionDays) map.set(d.date, d.contributionCount);
  return map;
}
