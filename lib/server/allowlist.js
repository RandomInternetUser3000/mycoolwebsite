import { readFile } from 'node:fs/promises';
import path from 'node:path';

const DEFAULT_ALLOWLIST_PATH = path.join(process.cwd(), 'content', 'admin-allowlist.json');
const DEFAULT_BRANCH = process.env.ALLOWLIST_BRANCH || 'main';
const OWNER = process.env.GITHUB_OWNER || 'COOLmanYT';
const REPO = process.env.GITHUB_REPO || 'mycoolwebsite';
const FILE_PATH = process.env.ALLOWLIST_FILE || 'content/admin-allowlist.json';
const API_BASE = 'https://api.github.com';
const COMMITTER_NAME = process.env.ALLOWLIST_COMMIT_NAME || 'COOLman Admin Bot';
const COMMITTER_EMAIL = process.env.ALLOWLIST_COMMIT_EMAIL || 'bot@coolmanyt.local';

function getGithubToken() {
  return process.env.ALLOWLIST_GITHUB_TOKEN;
}

async function readAllowlistFromFile() {
  try {
    const raw = await readFile(DEFAULT_ALLOWLIST_PATH, 'utf8');
    const data = JSON.parse(raw);
    return { users: Array.isArray(data.users) ? data.users : [], source: 'file', sha: null };
  } catch (error) {
    return { users: [], source: 'file', sha: null };
  }
}

async function fetchAllowlistFromGithub() {
  const token = getGithubToken();
  if (!token) {
    return readAllowlistFromFile();
  }

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}?ref=${encodeURIComponent(DEFAULT_BRANCH)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': `${OWNER}-${REPO}-admin-panel`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (!res.ok) {
    if (res.status === 404) {
      return readAllowlistFromFile();
    }
    throw new Error(`GitHub API error ${res.status}`);
  }

  const payload = await res.json();
  const content = Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
  const data = JSON.parse(content);
  return { users: Array.isArray(data.users) ? data.users : [], source: 'github', sha: payload.sha };
}

async function persistAllowlist(users, actor = 'admin-panel') {
  const token = getGithubToken();
  if (!token) {
    throw new Error('ALLOWLIST_GITHUB_TOKEN is not configured');
  }

  const uniqueUsers = Array.from(new Set(users.map((user) => user.trim()).filter(Boolean)));
  const latest = await fetchAllowlistFromGithub();
  const committerName = actor ? `${actor} via Admin Panel` : COMMITTER_NAME;
  const body = {
    message: `chore: update admin allowlist (${actor})`,
    content: Buffer.from(JSON.stringify({ users: uniqueUsers }, null, 2)).toString('base64'),
    sha: latest.sha,
    branch: DEFAULT_BRANCH,
    committer: {
      name: committerName,
      email: COMMITTER_EMAIL,
    },
  };

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${FILE_PATH}`, {
    method: 'PUT',
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': `${OWNER}-${REPO}-admin-panel`,
      Accept: 'application/vnd.github+json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`GitHub update failed (${res.status}): ${errorText}`);
  }

  return fetchAllowlistFromGithub();
}

export { fetchAllowlistFromGithub, persistAllowlist, readAllowlistFromFile };
