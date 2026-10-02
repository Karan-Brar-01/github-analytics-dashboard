const USERNAME = "Karan-Brar-01";
const API = "https://api.github.com";
const CACHE_KEY = `gitpulse:${USERNAME}:v1`;
const CACHE_MAX_AGE = 15 * 60 * 1000;
const LANGUAGE_COLORS = ["#baf86b", "#70e5c1", "#ffae72", "#b9a5ff", "#74b8ff", "#ff8c84", "#83988f"];

const FALLBACK = {
  user: {
    login: USERNAME,
    name: "Karan Brar",
    avatar_url: "https://avatars.githubusercontent.com/u/217916812?v=4",
    html_url: `https://github.com/${USERNAME}`,
    public_repos: 21,
    bio: "2nd year Data Science student at NIT Jalandhar · Python · C · C++ · Web Dev · ML · DSA",
  },
  repos: [
    ["ClinicalPulse", "Pre-clinical triage and clinician command center", "TypeScript", "2026-10-01T06:16:26Z"],
    ["distributed-ticketing-system", "Concurrent event booking with Redis, PostgreSQL, RabbitMQ and Docker", "TypeScript", "2026-10-01T04:23:44Z"],
    ["LeetCode", "Data structures and algorithm practice", "C++", "2026-09-30T17:31:09Z"],
    ["AcciSafe", "", "Python", "2026-09-30T07:39:12Z"],
    ["Advanced_RAG", "", "Python", "2026-09-30T07:39:14Z"],
    ["Mandi-Sync", "", "TypeScript", "2026-09-30T07:39:15Z"],
    ["Autonomous-Data-Analytics-Swarm", "", "Python", "2026-09-30T07:39:13Z"],
    ["Pulley_Systems_Visualisation", "", "TypeScript", "2026-09-30T07:39:11Z"],
    ["mini_support_agent", "", "Python", "2026-09-30T07:39:14Z"],
    ["EasyBuy", "", "TypeScript", "2026-09-30T07:39:17Z"],
    ["Portfolio", "", "TypeScript", "2026-09-13T18:15:20Z"],
    ["groundtruth", "", "Python", "2026-08-19T17:32:26Z"],
    ["Handshake-Dynamo-Assessment-task", "", "Python", "2026-07-22T13:38:39Z"],
    ["dsa-visualizer", "", "TypeScript", "2026-07-17T19:42:06Z"],
    ["the-hours-ecommerce", "", "TypeScript", "2026-06-06T13:24:06Z"],
    ["nl-to-sql", "", "JavaScript", "2026-03-21T16:51:11Z"],
    ["documind-demo", "", "Python", "2026-01-19T13:09:54Z"],
    ["NLP_along_with_FastAPI", "Learning NLP and applying FastAPI to models", "Jupyter Notebook", "2025-12-21T11:33:02Z"],
    ["pandas-mastery-challenge-", "Pandas learning exercises", "Jupyter Notebook", "2025-07-27T12:00:03Z"],
  ].map(([name, description, language, pushed_at]) => ({
    name,
    description,
    language,
    pushed_at,
    updated_at: pushed_at,
    html_url: `https://github.com/${USERNAME}/${name}`,
    stargazers_count: 0,
    forks_count: 0,
    open_issues_count: 0,
    archived: false,
    fork: false,
    has_wiki: true,
    license: null,
    topics: [],
    homepage: null,
  })),
  events: [],
};

const state = {
  data: null,
  visibleRepos: 8,
  query: "",
  sort: "momentum",
};

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchJson(path) {
  const response = await fetch(`${API}${path}`, {
    headers: {
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!response.ok) {
    const remaining = response.headers.get("x-ratelimit-remaining");
    throw new Error(response.status === 403 && remaining === "0" ? "GitHub's public API limit was reached." : `GitHub API returned ${response.status}.`);
  }
  return response.json();
}

async function loadData(force = false) {
  const cached = readCache();
  if (!force && cached && Date.now() - cached.timestamp < CACHE_MAX_AGE) {
    render(cached.data, cached.timestamp, false);
    return;
  }

  setLoading(true);
  try {
    const [user, repos, events] = await Promise.all([
      fetchJson(`/users/${USERNAME}`),
      fetchJson(`/users/${USERNAME}/repos?per_page=100&sort=pushed&type=owner`),
      fetchJson(`/users/${USERNAME}/events/public?per_page=100`),
    ]);
    const data = { user, repos: repos.filter((repo) => !repo.archived), events };
    localStorage.setItem(CACHE_KEY, JSON.stringify({ timestamp: Date.now(), data }));
    render(data, Date.now(), false);
    toast("Dashboard refreshed from GitHub.");
  } catch (error) {
    const safeData = cached?.data || FALLBACK;
    render(safeData, cached?.timestamp || Date.now(), true);
    toast(`${error.message} Showing the latest safe snapshot.`);
  } finally {
    setLoading(false);
  }
}

function readCache() {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY));
  } catch {
    return null;
  }
}

function render(data, timestamp, isFallback) {
  state.data = data;
  renderProfile(data.user);
  renderMetrics(data);
  renderActivity(data.events);
  renderLanguages(data.repos);
  renderRepositories();
  renderSignals(data);
  renderEvents(data.events, data.repos);
  $("#updated-label").textContent = `${isFallback ? "Snapshot" : "Live"} · ${relativeTime(new Date(timestamp))}`;
}

function renderProfile(user) {
  $("#sidebar-avatar").src = user.avatar_url;
  $("#hero-avatar").src = user.avatar_url;
  $("#profile-name").textContent = user.name || user.login;
  if (user.bio) $("#hero-copy").textContent = `${user.bio.replace(/\r?\n/g, " · ")} — visualized through live public repository signals.`;
}

function renderMetrics({ repos, events }) {
  const publicRepos = repos.filter((repo) => !repo.fork);
  const activeRecent = publicRepos.filter((repo) => daysSince(repo.pushed_at || repo.updated_at) <= 90).length;
  const pushes = events.filter((event) => event.type === "PushEvent").length;
  const languages = languageStats(publicRepos);
  const topLanguage = languages[0] || { name: "Mixed", count: 0, percent: 0 };
  const score = Math.round(publicRepos.reduce((sum, repo) => sum + momentumScore(repo), 0) / Math.max(publicRepos.length, 1));

  animateNumber($("#metric-repos"), publicRepos.length);
  animateNumber($("#metric-pushes"), pushes);
  $("#metric-recent").textContent = `${activeRecent} active in 90 days`;
  $("#metric-language").textContent = topLanguage.name;
  $("#metric-language-share").textContent = `${topLanguage.percent}% of repositories`;
  animateNumber($("#metric-score"), score);
  $("#metric-score-label").textContent = scoreLabel(score);
}

function renderActivity(events) {
  const weeks = createWeeks(12);
  events.filter((event) => event.type === "PushEvent").forEach((event) => {
    const created = new Date(event.created_at);
    const slot = weeks.find((week) => created >= week.start && created < week.end);
    if (slot) slot.value += 1;
  });

  const total = weeks.reduce((sum, week) => sum + week.value, 0);
  $("#activity-total").textContent = total;
  $("#activity-note").textContent = total ? "Across the latest public activity window" : "No public push events in GitHub's recent feed";
  $("#activity-chart").innerHTML = buildLineChart(weeks);
}

function createWeeks(count) {
  const end = new Date();
  end.setHours(23, 59, 59, 999);
  const day = end.getDay() || 7;
  end.setDate(end.getDate() + (7 - day));
  return Array.from({ length: count }, (_, index) => {
    const weekEnd = new Date(end);
    weekEnd.setDate(end.getDate() - (count - 1 - index) * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekEnd.getDate() - 7);
    weekStart.setHours(0, 0, 0, 0);
    return {
      start: weekStart,
      end: weekEnd,
      value: 0,
      label: weekStart.toLocaleDateString("en", { month: "short", day: "numeric" }),
    };
  });
}

function buildLineChart(series) {
  const width = 780;
  const height = 210;
  const pad = { top: 20, right: 16, bottom: 28, left: 22 };
  const max = Math.max(4, ...series.map((item) => item.value));
  const x = (index) => pad.left + (index / Math.max(series.length - 1, 1)) * (width - pad.left - pad.right);
  const y = (value) => pad.top + (1 - value / max) * (height - pad.top - pad.bottom);
  const points = series.map((item, index) => [x(index), y(item.value)]);
  const line = smoothPath(points);
  const area = `${line} L ${x(series.length - 1)} ${height - pad.bottom} L ${x(0)} ${height - pad.bottom} Z`;
  const grid = [0, 0.33, 0.66, 1].map((ratio) => {
    const gy = pad.top + ratio * (height - pad.top - pad.bottom);
    return `<line class="chart-grid" x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}" />`;
  }).join("");
  const labels = series.map((item, index) => index % 2 === 0 || index === series.length - 1
    ? `<text class="chart-label" x="${x(index)}" y="${height - 7}" text-anchor="middle">${item.label}</text>`
    : "").join("");
  const dots = series.map((item, index) => item.value
    ? `<g><circle class="chart-point" cx="${x(index)}" cy="${y(item.value)}" r="3.3"/><text class="chart-value" x="${x(index)}" y="${y(item.value) - 9}" text-anchor="middle">${item.value}</text></g>`
    : "").join("");

  return `<svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Public push events per week">
    <defs><linearGradient id="activityGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#baf86b" stop-opacity=".22"/><stop offset="100%" stop-color="#baf86b" stop-opacity="0"/></linearGradient></defs>
    ${grid}<path class="chart-area" d="${area}"/><path class="chart-line" d="${line}"/>${dots}${labels}
  </svg>`;
}

function smoothPath(points) {
  if (!points.length) return "";
  return points.reduce((path, point, index, all) => {
    if (index === 0) return `M ${point[0]} ${point[1]}`;
    const previous = all[index - 1];
    const midpoint = (previous[0] + point[0]) / 2;
    return `${path} C ${midpoint} ${previous[1]}, ${midpoint} ${point[1]}, ${point[0]} ${point[1]}`;
  }, "");
}

function renderLanguages(repos) {
  const stats = languageStats(repos.filter((repo) => !repo.fork));
  $("#language-count").textContent = stats.length;
  let cursor = 0;
  const stops = stats.slice(0, 6).map((item, index) => {
    const start = cursor;
    cursor += item.percent;
    return `${LANGUAGE_COLORS[index]} ${start}% ${cursor}%`;
  });
  if (cursor < 100) stops.push(`#40534a ${cursor}% 100%`);
  $("#language-donut").style.background = `conic-gradient(${stops.join(",")})`;
  $("#language-legend").innerHTML = stats.slice(0, 6).map((item, index) => `
    <div class="language-item">
      <i style="background:${LANGUAGE_COLORS[index]}"></i>
      <span>${escapeHtml(item.name)}</span>
      <strong>${item.percent}%</strong>
    </div>
  `).join("") || '<p class="panel-caption">No languages detected yet.</p>';
}

function languageStats(repos) {
  const counts = repos.reduce((map, repo) => {
    const language = repo.language || "Other";
    map.set(language, (map.get(language) || 0) + 1);
    return map;
  }, new Map());
  const total = Math.max(repos.length, 1);
  return [...counts.entries()]
    .map(([name, count]) => ({ name, count, percent: Math.round((count / total) * 100) }))
    .sort((a, b) => b.count - a.count);
}

function renderRepositories() {
  if (!state.data) return;
  let repos = state.data.repos.filter((repo) => !repo.archived && !repo.fork);
  const query = state.query.trim().toLowerCase();
  if (query) repos = repos.filter((repo) => `${repo.name} ${repo.description || ""} ${repo.language || ""}`.toLowerCase().includes(query));
  repos.sort((a, b) => {
    if (state.sort === "name") return a.name.localeCompare(b.name);
    if (state.sort === "recent") return new Date(b.pushed_at || b.updated_at) - new Date(a.pushed_at || a.updated_at);
    return momentumScore(b) - momentumScore(a);
  });

  const shown = repos.slice(0, state.visibleRepos);
  $("#repo-table-body").innerHTML = shown.map((repo) => {
    const score = momentumScore(repo);
    const signal = repositorySignal(repo, score);
    return `<tr>
      <td><div class="repo-name"><a href="${escapeHtml(repo.html_url)}" target="_blank" rel="noreferrer">${escapeHtml(repo.name)} ↗</a><span>${escapeHtml(repo.description || "Description opportunity")}</span></div></td>
      <td><span class="language-cell"><i class="lang-dot" style="background:${languageColor(repo.language)}"></i>${escapeHtml(repo.language || "Other")}</span></td>
      <td>${relativeTime(new Date(repo.pushed_at || repo.updated_at))}</td>
      <td class="momentum-cell"><div class="momentum-top"><span>${scoreLabel(score)}</span><strong>${score}</strong></div><div class="progress"><span style="width:${score}%"></span></div></td>
      <td><span class="signal-badge ${signal.className}">${signal.label}</span></td>
    </tr>`;
  }).join("") || '<tr><td colspan="5" class="loading-row">No repositories match that search.</td></tr>';

  $("#repo-count-label").textContent = `Showing ${shown.length} of ${repos.length} repositories`;
  $("#show-more").hidden = shown.length >= repos.length;
}

function renderSignals({ repos, events }) {
  const portfolio = repos.filter((repo) => !repo.fork && !repo.archived);
  const recent = portfolio.filter((repo) => daysSince(repo.pushed_at || repo.updated_at) <= 90).length;
  const described = portfolio.filter((repo) => Boolean(repo.description?.trim())).length;
  const language = languageStats(portfolio)[0] || { name: "Mixed", percent: 0 };
  const pushedRepos = new Set(events.filter((event) => event.type === "PushEvent").map((event) => event.repo?.name).filter(Boolean));

  const signals = [
    { icon: "↗", title: "Active portfolio", copy: "Repositories pushed within the past 90 days.", value: `${recent}/${portfolio.length}` },
    { icon: "◎", title: "Documentation coverage", copy: "Repositories with a public description that explains the work.", value: `${Math.round((described / Math.max(portfolio.length, 1)) * 100)}%` },
    { icon: "◇", title: `${language.name} concentration`, copy: "Share of the portfolio using the leading primary language.", value: `${language.percent}%` },
    { icon: "⌁", title: "Recent delivery breadth", copy: "Repositories represented in the public push-event window.", value: pushedRepos.size },
  ];

  $("#signals-list").innerHTML = signals.map((signal) => `
    <div class="signal-item">
      <span class="signal-icon">${signal.icon}</span>
      <div class="signal-copy"><strong>${escapeHtml(signal.title)}</strong><p>${escapeHtml(signal.copy)}</p></div>
      <span class="signal-value">${escapeHtml(signal.value)}</span>
    </div>
  `).join("");
}

function renderEvents(events, repos) {
  const usable = events.filter((event) => ["PushEvent", "CreateEvent", "PullRequestEvent", "IssuesEvent", "ReleaseEvent", "WatchEvent"].includes(event.type)).slice(0, 7);
  const fallbackEvents = repos.slice(0, 6).map((repo) => ({
    type: "RepositoryUpdate",
    repo: { name: `${USERNAME}/${repo.name}` },
    created_at: repo.pushed_at || repo.updated_at,
  }));
  const items = usable.length ? usable : fallbackEvents;

  $("#event-list").innerHTML = items.map((event) => {
    const meta = eventMeta(event);
    const repoName = (event.repo?.name || "Repository").replace(`${USERNAME}/`, "");
    return `<a class="event-item" href="https://github.com/${escapeHtml(event.repo?.name || `${USERNAME}/${repoName}`)}" target="_blank" rel="noreferrer">
      <span class="event-mark">${meta.icon}</span>
      <span class="event-copy"><strong>${escapeHtml(repoName)}</strong><span>${escapeHtml(meta.label)}</span></span>
      <span class="event-time">${relativeTime(new Date(event.created_at))}</span>
    </a>`;
  }).join("") || '<p class="panel-caption">No recent public activity is available.</p>';
}

function eventMeta(event) {
  if (event.type === "PushEvent") {
    const commits = eventCommitCount(event);
    return { icon: "↗", label: commits ? `${commits} commit${commits === 1 ? "" : "s"} pushed` : "Repository push recorded" };
  }
  if (event.type === "CreateEvent") return { icon: "+", label: `${event.payload?.ref_type || "Repository item"} created` };
  if (event.type === "PullRequestEvent") return { icon: "⑂", label: `Pull request ${event.payload?.action || "updated"}` };
  if (event.type === "IssuesEvent") return { icon: "!", label: `Issue ${event.payload?.action || "updated"}` };
  if (event.type === "ReleaseEvent") return { icon: "◇", label: "Release published" };
  if (event.type === "WatchEvent") return { icon: "☆", label: "Repository starred" };
  return { icon: "•", label: "Repository updated" };
}

function eventCommitCount(event) {
  return event.payload?.size ?? event.payload?.commits?.length ?? 0;
}

function momentumScore(repo) {
  const age = daysSince(repo.pushed_at || repo.updated_at);
  const freshness = age <= 30 ? 50 : age <= 90 ? 42 : age <= 180 ? 32 : age <= 365 ? 20 : 8;
  const clarity = (repo.description?.trim() ? 14 : 0) + (repo.topics?.length ? 8 : 0) + (repo.homepage ? 5 : 0);
  const stewardship = (repo.license ? 8 : 0) + (repo.has_wiki ? 4 : 0);
  const adoption = Math.min(11, (repo.stargazers_count || 0) * 2 + (repo.forks_count || 0) * 3);
  return Math.min(100, freshness + clarity + stewardship + adoption);
}

function repositorySignal(repo, score) {
  if (daysSince(repo.pushed_at || repo.updated_at) <= 30) return { label: "Active", className: "" };
  if (score >= 55) return { label: "Healthy", className: "" };
  if (!repo.description?.trim()) return { label: "Add context", className: "watch" };
  return { label: "Quiet", className: "quiet" };
}

function scoreLabel(score) {
  if (score >= 80) return "Excellent";
  if (score >= 65) return "Strong";
  if (score >= 48) return "Healthy";
  if (score >= 30) return "Developing";
  return "Quiet";
}

function languageColor(language) {
  const colors = {
    TypeScript: "#74b8ff",
    JavaScript: "#f1e05a",
    Python: "#70e5c1",
    "C++": "#ff8c84",
    C: "#b9a5ff",
    Shell: "#baf86b",
    HTML: "#ffae72",
    "Jupyter Notebook": "#da7b36",
  };
  return colors[language] || "#83988f";
}

function daysSince(date) {
  return Math.max(0, (Date.now() - new Date(date).getTime()) / 86400000);
}

function relativeTime(date) {
  const seconds = Math.max(0, Math.floor((Date.now() - date.getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}

function animateNumber(element, target) {
  const start = performance.now();
  const duration = 500;
  const step = (time) => {
    const progress = Math.min(1, (time - start) / duration);
    const eased = 1 - Math.pow(1 - progress, 3);
    element.textContent = Math.round(target * eased).toLocaleString();
    if (progress < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function setLoading(loading) {
  $("#refresh-button").classList.toggle("loading", loading);
  $("#refresh-button").disabled = loading;
}

let toastTimer;
function toast(message) {
  clearTimeout(toastTimer);
  const element = $("#toast");
  element.textContent = message;
  element.classList.add("show");
  toastTimer = setTimeout(() => element.classList.remove("show"), 3200);
}

$("#refresh-button").addEventListener("click", () => loadData(true));
$("#repo-search").addEventListener("input", (event) => {
  state.query = event.target.value;
  state.visibleRepos = 8;
  renderRepositories();
});
$("#repo-sort").addEventListener("change", (event) => {
  state.sort = event.target.value;
  renderRepositories();
});
$("#show-more").addEventListener("click", () => {
  state.visibleRepos += 8;
  renderRepositories();
});
$("#mobile-menu").addEventListener("click", () => $(".sidebar").classList.toggle("open"));
$$('.nav-link').forEach((link) => link.addEventListener("click", () => {
  $$(".nav-link").forEach((item) => item.classList.remove("active"));
  link.classList.add("active");
  $(".sidebar").classList.remove("open");
}));

loadData();
