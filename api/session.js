import { getSessionFromRequest } from '../lib/server/auth.js';
import { fetchAllowlistFromGithub } from '../lib/server/allowlist.js';
import { sendJson } from '../lib/server/http.js';
import fs from 'fs/promises';
import path from 'path';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET, OPTIONS');
    res.end('Method Not Allowed');
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 200, { authenticated: false });
    return;
  }

  const allowlist = await fetchAllowlistFromGithub();
  const baseUrl = (process.env.SITE_BASE_URL || deriveBaseUrl(req)).replace(/\/$/, '');
  const webhookConfigured = await hasWebhookConfigured();
  sendJson(res, 200, {
    authenticated: true,
    user: {
      login: session.login,
      name: session.name,
      avatarUrl: session.avatarUrl,
    },
    allowlist: allowlist.users,
    allowlistSource: allowlist.source,
    canEditAllowlist: Boolean(process.env.ALLOWLIST_GITHUB_TOKEN),
    distribution: {
      rssUrl: `${baseUrl}/blog/feed.xml`,
      webhookConfigured,
    },
  });
}

function deriveBaseUrl(req) {
  const headers = req.headers || {};
  const host = headers.host || 'localhost:3000';
  const forwardedProto = headers['x-forwarded-proto'];
  const isLocalhost = /localhost|127\.0\.0\.1/.test(host);
  const proto = forwardedProto || (isLocalhost ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function hasWebhookConfigured() {
  if (process.env.DISCORD_WEBHOOK_URL) {
    return true;
  }
  try {
    const configPath = path.join(process.cwd(), 'content', 'webhooks.json');
    const raw = await fs.readFile(configPath, 'utf8');
    const json = JSON.parse(raw);
    return Array.isArray(json.webhooks) && json.webhooks.length > 0;
  } catch (error) {
    return false;
  }
}
