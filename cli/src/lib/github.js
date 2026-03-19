import { execFile } from 'node:child_process';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

/**
 * Parse a GitHub URL into { owner, repo, type, number }.
 * Supports:
 *   https://github.com/owner/repo/issues/123
 *   https://github.com/owner/repo/pull/456
 *   github.com/owner/repo/issues/123
 */
export function parseGitHubUrl(url) {
  // Normalize: strip protocol, trailing slashes
  const cleaned = url.replace(/^https?:\/\//, '').replace(/\/$/, '');
  const match = cleaned.match(
    /^github\.com\/([^/]+)\/([^/]+)\/(issues|pull)\/(\d+)/
  );
  if (!match) return null;

  return {
    owner: match[1],
    repo: match[2],
    type: match[3] === 'pull' ? 'pr' : 'issue',
    number: parseInt(match[4], 10),
  };
}

/**
 * Fetch metadata for a GitHub issue or PR.
 * Tries `gh` CLI first, then falls back to GITHUB_TOKEN + fetch.
 * Syncs as much metadata as possible: labels, assignees, body, comments, dates, etc.
 */
export async function fetchGitHubMeta(parsed) {
  const { owner, repo, type, number } = parsed;

  // Try gh CLI first
  try {
    return await fetchViaGhCli(owner, repo, type, number);
  } catch {
    // Fall back to fetch API
  }

  // Try GITHUB_TOKEN + fetch
  const token = process.env.GITHUB_TOKEN;
  if (token) {
    try {
      return await fetchViaApi(owner, repo, type, number, token);
    } catch {
      // Give up
    }
  }

  return null;
}

async function fetchViaGhCli(owner, repo, type, number) {
  const subcommand = type === 'pr' ? 'pr' : 'issue';
  const fields =
    'title,state,labels,milestone,assignees,body,comments,createdAt,updatedAt,closedAt,author';
  const { stdout } = await execFileAsync('gh', [
    subcommand,
    'view',
    String(number),
    '--repo',
    `${owner}/${repo}`,
    '--json',
    fields,
  ]);

  const data = JSON.parse(stdout);
  return formatMeta(owner, repo, type, number, data);
}

async function fetchViaApi(owner, repo, type, number, token) {
  const endpoint =
    type === 'pr'
      ? `https://api.github.com/repos/${owner}/${repo}/pulls/${number}`
      : `https://api.github.com/repos/${owner}/${repo}/issues/${number}`;

  const res = await fetch(endpoint, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) throw new Error(`GitHub API returned ${res.status}`);
  const data = await res.json();
  return formatMeta(owner, repo, type, number, data);
}

function formatMeta(owner, repo, type, number, data) {
  const labels = Array.isArray(data.labels)
    ? data.labels.map((l) => {
        if (typeof l === 'string') return { name: l, color: null };
        return { name: l.name, color: l.color || null };
      })
    : [];

  const milestone = data.milestone;
  const milestoneName = milestone?.title ?? null;
  const milestoneDueOn = milestone?.due_on?.slice(0, 10) ?? null;

  // Assignees — gh CLI returns [{login}], REST API returns [{login, avatar_url}]
  const assignees = Array.isArray(data.assignees)
    ? data.assignees.map((a) => (typeof a === 'string' ? a : a.login))
    : [];

  // Author
  const author = data.author?.login || data.user?.login || null;

  // Body — store first 200 chars as excerpt
  const bodyExcerpt = data.body ? data.body.slice(0, 200) : null;

  // Comments count
  const commentsCount =
    typeof data.comments === 'number'
      ? data.comments
      : Array.isArray(data.comments)
        ? data.comments.length
        : 0;

  return {
    type,
    owner,
    repo,
    number,
    title: data.title || null,
    state: data.state || null,
    labels,
    milestone: milestoneName,
    milestoneDueOn,
    assignees,
    author,
    bodyExcerpt,
    commentsCount,
    ghCreatedAt: data.createdAt || data.created_at || null,
    ghUpdatedAt: data.updatedAt || data.updated_at || null,
    ghClosedAt: data.closedAt || data.closed_at || null,
    fetchedAt: new Date().toISOString(),
  };
}
