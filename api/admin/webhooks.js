import { readJsonBody, sendJson, methodNotAllowed } from '../../lib/server/http.js';

const OWNER = process.env.GITHUB_OWNER || 'RandomInternetUser3000';
const REPO = process.env.GITHUB_REPO || 'mycoolwebsite';
const BRANCH = process.env.ALLOWLIST_BRANCH || 'main';
const FILE_PATH = 'content/webhooks.json';
const API_BASE = 'https://api.github.com';
const COMMITTER_NAME = process.env.ALLOWLIST_COMMIT_NAME || 'COOLman Admin Bot';
const COMMITTER_EMAIL = process.env.ALLOWLIST_COMMIT_EMAIL || 'bot@coolmanyt.local';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const token = process.env.ALLOWLIST_GITHUB_TOKEN;
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  switch (req.method) {
    case 'GET':
      await handleGet(res, token);
      break;
    case 'POST':
    case 'PUT':
      await handleUpdate(req, res, token);
      break;
    default:
      methodNotAllowed(res, ['GET', 'POST', 'PUT', 'OPTIONS']);
  }
}

async function handleGet(res, token) {
  try {
    const payload = await fetchFileFromGithub(FILE_PATH, token, { allow404: true });
    const data = payload.data || defaultConfig();
    sendJson(res, 200, { data, source: payload.source || 'file' });
  } catch (error) {
    console.error('Webhooks fetch failed', error);
    sendJson(res, 500, { error: 'Failed to load webhooks config.' });
  }
}

async function handleUpdate(req, res, token) {
  if (!token) {
    sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
    return;
  }
  try {
    const body = await readJsonBody(req);
    const cleaned = sanitizeConfig(body || {});
    const current = await fetchFileFromGithub(FILE_PATH, token, { allow404: true });
    const next = { ...defaultConfig(), ...current.data, ...cleaned };
    const updated = await writeFileToGithub(FILE_PATH, next, token, current.sha, 'update webhooks config');
    sendJson(res, 200, { data: updated.data, source: updated.source });
  } catch (error) {
    console.error('Webhooks update failed', error);
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to update webhooks.' });
  }
}

function sanitizeConfig(input) {
  const out = {};
  if (typeof input.messageTemplate === 'string') {
    out.messageTemplate = input.messageTemplate;
  }
  if (input.embedTemplate && typeof input.embedTemplate === 'object') {
    out.embedTemplate = input.embedTemplate;
  }
  if (Array.isArray(input.webhooks)) {
    out.webhooks = input.webhooks
      .map((hook) => {
        const url = typeof hook.url === 'string' ? hook.url.trim() : '';
        const label = typeof hook.label === 'string' ? hook.label.trim() : '';
        if (!url) return null;
        const id = (hook.id || generateId()).toString();
        return { id, label: label || 'Webhook', url };
      })
      .filter(Boolean);
  }
  return out;
}

function defaultConfig() {
  return {
    messageTemplate: 'New blog update: **{title}** — {summary}\n{url}',
    embedTemplate: {
      title: '{title}',
      description: '{summary}\n{url}',
      color: 5793266,
    },
    webhooks: [],
  };
}

async function fetchFileFromGithub(path, token, options = {}) {
  const { allow404 = false } = options;
  if (!token) {
    const fs = await import('node:fs/promises');
    const pathMod = await import('node:path');
    const abs = pathMod.default.join(process.cwd(), path);
    try {
      const raw = await fs.readFile(abs, 'utf8');
      return { data: JSON.parse(raw), source: 'file', sha: null };
    } catch (error) {
      if (allow404 && error.code === 'ENOENT') {
        return { data: null, source: 'file', sha: null };
      }
      throw error;
    }
  }

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(BRANCH)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': `${OWNER}-${REPO}-admin-panel`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (res.status === 404 && allow404) {
    return { data: null, source: 'github', sha: null };
  }

  if (!res.ok) {
    const err = new Error(`GitHub API error ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }

  const payload = await res.json();
  const content = Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
  return { data: JSON.parse(content), source: 'github', sha: payload.sha };
}

async function writeFileToGithub(path, data, token, sha, message) {
  const body = {
    message: `chore: ${message}`,
    content: Buffer.from(JSON.stringify(data, null, 2)).toString('base64'),
    sha,
    branch: BRANCH,
    committer: {
      name: COMMITTER_NAME,
      email: COMMITTER_EMAIL,
    },
  };

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(path)}`, {
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
    const err = new Error(`GitHub update failed (${res.status}): ${errorText}`);
    err.statusCode = res.status;
    throw err;
  }
  const payload = await res.json();
  return { data, source: 'github', sha: payload.content?.sha || sha };
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}
