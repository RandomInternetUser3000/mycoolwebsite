import { requireAllowlistedSession } from '../../lib/server/auth.js';
import { sendJson, methodNotAllowed } from '../../lib/server/http.js';
import fs from 'fs/promises';
import path from 'path';

export const config = { runtime: 'nodejs' };

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

  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  const config = await loadWebhookConfig();
  const targetWebhook = resolveWebhookFromEnv(config);
  const webhookUrl = targetWebhook?.url || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    sendJson(res, 501, { error: 'No webhook configured. Add one in the admin panel or set DISCORD_WEBHOOK_URL.' });
    return;
  }

  try {
    await sendTestPing(webhookUrl, buildPayload(auth.session, req, config));
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

function buildPayload(session, req, config = {}) {
  const baseUrl = (process.env.SITE_BASE_URL || deriveBaseUrl(req)).replace(/\/$/, '');
  const displayName = session.name || session.login || 'unknown admin';
  const template = config.messageTemplate || '🔔 Blog webhook test ping from {admin} at {site}';
  const tokens = {
    admin: session.login || 'unknown',
    site: baseUrl,
    title: 'Test Ping',
    summary: 'Manual webhook test from admin panel',
    url: baseUrl,
    tag: 'test',
    date: new Date().toISOString(),
  };
  const content = applyTemplate(template, tokens);

  const embedTemplate = config.embedTemplate || {
    title: 'COOLmanYT Blog · Webhook test',
    description: `Manual test triggered by {admin}`,
    color: 0x5865f2,
    footer: { text: 'Triggered via admin panel' },
  };
  const embed = applyEmbedTemplate(embedTemplate, tokens);
  const embeds = embed ? [embed] : undefined;
  return embeds ? { content, embeds } : { content };
}

function applyTemplate(str, tokens) {
  return String(str || '').replace(/\{(\w+)\}/g, (_, key) => tokens[key] ?? `{${key}}`);
}

function applyEmbedTemplate(template, tokens) {
  if (!template || typeof template !== 'object') return null;
  const clone = JSON.parse(JSON.stringify(template));
  const walk = (node) => {
    if (typeof node === 'string') return applyTemplate(node, tokens);
    if (Array.isArray(node)) return node.map(walk);
    if (node && typeof node === 'object') {
      return Object.fromEntries(Object.entries(node).map(([k, v]) => [k, walk(v)]));
    }
    return node;
  };
  return walk(clone);
}

function deriveBaseUrl(req) {
  const headers = req.headers || {};
  const host = headers.host || 'localhost:3000';
  const forwardedProto = headers['x-forwarded-proto'];
  const isLocalhost = /localhost|127\.0\.0\.1/.test(host);
  const proto = forwardedProto || (isLocalhost ? 'http' : 'https');
  return `${proto}://${host}`;
}

async function loadWebhookConfig() {
  try {
    const configPath = path.join(process.cwd(), 'content', 'webhooks.json');
    const raw = await fs.readFile(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    return {};
  }
}

function resolveWebhookFromEnv(config = {}) {
  const list = Array.isArray(config.webhooks) ? config.webhooks : [];
  for (const hook of list) {
    const envVar = (hook.envVar || hook.env || '').toString().trim();
    if (!envVar) continue;
    const url = process.env[envVar];
    if (url) {
      return { envVar, url };
    }
  }
  return null;
}
