import { getSessionFromRequest } from '../../lib/server/auth.js';
import { fetchAllowlistFromGithub, persistAllowlist } from '../../lib/server/allowlist.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../../lib/server/http.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  switch (req.method) {
    case 'GET':
      await handleGet(res);
      break;
    case 'POST':
      await handleAdd(req, res, session);
      break;
    case 'DELETE':
      await handleRemove(req, res, session);
      break;
    default:
      methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  }
}

async function handleGet(res) {
  const allowlist = await fetchAllowlistFromGithub();
  sendJson(res, 200, {
    users: allowlist.users,
    canEdit: Boolean(process.env.ALLOWLIST_GITHUB_TOKEN),
    source: allowlist.source,
  });
}

async function handleAdd(req, res, session) {
  if (!process.env.ALLOWLIST_GITHUB_TOKEN) {
    sendJson(res, 501, { error: 'Allow list editing is not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const username = sanitizeUsername(body.username);
    if (!username) {
      sendJson(res, 400, { error: 'username is required' });
      return;
    }

    const allowlist = await fetchAllowlistFromGithub();
    if (allowlist.users.map((u) => u.toLowerCase()).includes(username.toLowerCase())) {
      sendJson(res, 200, { users: allowlist.users, message: 'User already in allow list.' });
      return;
    }

    allowlist.users.push(username);
    const updated = await persistAllowlist(allowlist.users, session.login);
    sendJson(res, 200, { users: updated.users, message: `${username} added.` });
  } catch (error) {
    console.error('Allowlist add failed', error);
    sendJson(res, 500, { error: 'Failed to update allow list.' });
  }
}

async function handleRemove(req, res, session) {
  if (!process.env.ALLOWLIST_GITHUB_TOKEN) {
    sendJson(res, 501, { error: 'Allow list editing is not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
    return;
  }

  try {
    const body = await readJsonBody(req);
    const username = sanitizeUsername(body.username);
    if (!username) {
      sendJson(res, 400, { error: 'username is required' });
      return;
    }

    const allowlist = await fetchAllowlistFromGithub();
    const filtered = allowlist.users.filter((user) => user.toLowerCase() !== username.toLowerCase());
    if (filtered.length === allowlist.users.length) {
      sendJson(res, 404, { error: 'User not found on allow list.' });
      return;
    }

    const updated = await persistAllowlist(filtered, session.login);
    sendJson(res, 200, { users: updated.users, message: `${username} removed.` });
  } catch (error) {
    console.error('Allowlist remove failed', error);
    sendJson(res, 500, { error: 'Failed to update allow list.' });
  }
}

function sanitizeUsername(value = '') {
  return value.trim().replace(/^@/, '');
}
