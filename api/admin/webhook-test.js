import { getSessionFromRequest } from '../../lib/server/auth.js';
import { sendJson, methodNotAllowed } from '../../lib/server/http.js';

export const config = { runtime: 'nodejs18.x' };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== 'POST') {
    methodNotAllowed(res, ['POST', 'OPTIONS']);
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    sendJson(res, 401, { error: 'Unauthorized' });
    return;
  }

  const webhookUrl = process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    sendJson(res, 501, { error: 'DISCORD_WEBHOOK_URL is not configured.' });
    return;
  }

  try {
    await sendTestPing(webhookUrl, buildPayload(session, req));
    sendJson(res, 200, { message: 'Webhook ping sent to Discord.' });
  } catch (error) {
    console.error('Webhook test failed', error);
    const status = error.statusCode || error.status || 502;
    sendJson(res, status, { error: error.message || 'Failed to deliver webhook ping.' });
  }
}

async function sendTestPing(url, payload) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const text = await response.text().catch(() => '');
  if (!response.ok) {
    const error = new Error(`Discord webhook rejected the request (${response.status}).`);
    error.statusCode = response.status;
    error.details = text;
    throw error;
  }
  return text;
}

function buildPayload(session, req) {
  const baseUrl = (process.env.SITE_BASE_URL || deriveBaseUrl(req)).replace(/\/$/, '');
  const displayName = session.name || session.login || 'unknown admin';
  return {
    content: '🔔 Blog webhook test ping',
    embeds: [
      {
        title: 'COOLmanYT Blog · Webhook test',
        description: `Manual test triggered by **${displayName}**`,
        color: 0x5865f2,
        timestamp: new Date().toISOString(),
        fields: [
          { name: 'Admin', value: session.login || 'unknown', inline: true },
          { name: 'Site', value: baseUrl, inline: true },
        ],
        footer: { text: 'Triggered via admin panel' },
      },
    ],
  };
}

function deriveBaseUrl(req) {
  const headers = req.headers || {};
  const host = headers.host || 'localhost:3000';
  const forwardedProto = headers['x-forwarded-proto'];
  const isLocalhost = /localhost|127\.0\.0\.1/.test(host);
  const proto = forwardedProto || (isLocalhost ? 'http' : 'https');
  return `${proto}://${host}`;
}
