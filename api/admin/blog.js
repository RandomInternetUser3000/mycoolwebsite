import { requireAllowlistedSession } from '../../lib/server/auth.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../../lib/server/http.js';

const OWNER = process.env.GITHUB_OWNER || 'COOLmanYT';
const REPO = process.env.GITHUB_REPO || 'mycoolwebsite';
const BRANCH = process.env.ALLOWLIST_BRANCH || 'main';
const API_BASE = 'https://api.github.com';
const CONTENT_ROOT = 'blog/content';
const COMMITTER_NAME = process.env.ALLOWLIST_COMMIT_NAME || 'COOLman Admin Bot';
const COMMITTER_EMAIL = process.env.ALLOWLIST_COMMIT_EMAIL || 'bot@coolmanyt.local';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  const token = process.env.ALLOWLIST_GITHUB_TOKEN;
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  switch (req.method) {
    case 'GET':
      await handleGet(req, res, token);
      break;
    case 'POST':
    case 'PUT':
      await handleUpsert(req, res, token);
      break;
    case 'DELETE':
      await handleDelete(req, res, token);
      break;
    default:
      methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
  }
}

function validateSlug(slug) {
  const trimmed = (slug || '').toString().trim();
  if (!trimmed) {
    throw Object.assign(new Error('Slug is required'), { statusCode: 400 });
  }
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    throw Object.assign(new Error('Slug must use lowercase letters, numbers, and hyphens only'), { statusCode: 400 });
  }
  return trimmed;
}

async function handleGet(req, res, token) {
  try {
    const url = new URL(req.url, 'http://localhost');
    const slug = validateSlug(url.searchParams.get('slug'));
    const path = `${CONTENT_ROOT}/${slug}.md`;
    const payload = await fetchFileFromGithub(path, token);
    if (!payload.data) {
      sendJson(res, 404, { error: 'Post not found' });
      return;
    }
    sendJson(res, 200, { slug, content: payload.data, sha: payload.sha, source: payload.source, path });
  } catch (error) {
    console.error('Blog GET failed', error);
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to load post' });
  }
}

async function handleUpsert(req, res, token) {
  if (!token) {
    sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
    return;
  }
  try {
    const body = await readJsonBody(req);
    const slug = validateSlug(body.slug);
    const content = (body.content || '').toString();
    if (!content.trim()) {
      throw Object.assign(new Error('Content cannot be empty'), { statusCode: 400 });
    }
    const path = `${CONTENT_ROOT}/${slug}.md`;
    const current = await fetchFileFromGithub(path, token, { allow404: true });
    const sha = body.sha || current.sha || undefined;
    const writeResult = await writeFileToGithub(path, content, token, sha, `update blog post: ${slug}`);
    sendJson(res, 200, { slug, sha: writeResult.sha, path: writeResult.path, source: writeResult.source });
  } catch (error) {
    console.error('Blog save failed', error);
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to save post' });
  }
}

async function handleDelete(req, res, token) {
  if (!token) {
    sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
    return;
  }
  try {
    const body = await readJsonBody(req);
    const slug = validateSlug(body.slug);
    const path = `${CONTENT_ROOT}/${slug}.md`;
    const current = await fetchFileFromGithub(path, token);
    if (!current.sha) {
      throw Object.assign(new Error('Post not found'), { statusCode: 404 });
    }
    await deleteFileFromGithub(path, token, current.sha, `delete blog post: ${slug}`);
    sendJson(res, 200, { slug, deleted: true, path });
  } catch (error) {
    console.error('Blog delete failed', error);
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to delete post' });
  }
}

function encodeGithubPath(path) {
  return path
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function fetchFileFromGithub(path, token, options = {}) {
  const { allow404 = false } = options;
  if (!token) {
    const fs = await import('node:fs/promises');
    const pathMod = await import('node:path');
    const abs = pathMod.default.join(process.cwd(), path);
    try {
      const raw = await fs.readFile(abs, 'utf8');
      return { data: raw, source: 'file', sha: null, path };
    } catch (error) {
      if (allow404 && error.code === 'ENOENT') {
        return { data: null, source: 'file', sha: null, path };
      }
      throw error;
    }
  }

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeGithubPath(path)}?ref=${encodeURIComponent(BRANCH)}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': `${OWNER}-${REPO}-admin-panel`,
      Accept: 'application/vnd.github+json',
    },
  });

  if (res.status === 404 && allow404) {
    return { data: null, source: 'github', sha: null, path };
  }

  if (!res.ok) {
    const err = new Error(`GitHub API error ${res.status}`);
    err.statusCode = res.status;
    throw err;
  }

  const payload = await res.json();
  const content = Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
  return { data: content, source: 'github', sha: payload.sha, path };
}

async function writeFileToGithub(path, content, token, sha, message) {
  const body = {
    message: `chore: ${message}`,
    content: Buffer.from(content).toString('base64'),
    sha,
    branch: BRANCH,
    committer: {
      name: COMMITTER_NAME,
      email: COMMITTER_EMAIL,
    },
  };

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeGithubPath(path)}`, {
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
  return { sha: payload.content?.sha || sha || null, path, source: 'github' };
}

async function deleteFileFromGithub(path, token, sha, message) {
  const body = {
    message: `chore: ${message}`,
    sha,
    branch: BRANCH,
    committer: {
      name: COMMITTER_NAME,
      email: COMMITTER_EMAIL,
    },
  };

  const res = await fetch(`${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeGithubPath(path)}`, {
    method: 'DELETE',
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
    const err = new Error(`GitHub delete failed (${res.status}): ${errorText}`);
    err.statusCode = res.status;
    throw err;
  }
  return { deleted: true, path };
}
