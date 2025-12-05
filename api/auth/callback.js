import { buildSessionCookie, clearStateCookie, requiredEnv, verifyStateCookie } from '../../lib/server/auth.js';
import { fetchAllowlistFromGithub } from '../../lib/server/allowlist.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const url = new URL(req.url, deriveBaseUrl(req));
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');

  if (!code || !state) {
    res.statusCode = 400;
    res.end('Missing OAuth parameters');
    return;
  }

  if (!verifyStateCookie(state, req.headers.cookie || req.headers.Cookie || '')) {
    res.statusCode = 400;
    res.end('Invalid OAuth state');
    return;
  }

  try {
    const token = await exchangeCodeForToken(code, buildCallbackUrl(req));
    const profile = await fetchGithubProfile(token);
    const allowlist = await fetchAllowlistFromGithub();
    const normalized = allowlist.users.map((user) => user.toLowerCase());

    if (!profile?.login || !normalized.includes(profile.login.toLowerCase())) {
      res.statusCode = 403;
      res.end('Your GitHub account is not on the allow list.');
      return;
    }

    const sessionCookie = buildSessionCookie(profile);
    res.setHeader('Set-Cookie', [clearStateCookie(), sessionCookie]);
    res.statusCode = 302;
    res.setHeader('Location', '/admin.html');
    res.end();
  } catch (error) {
    console.error('OAuth callback failed', error);
    res.statusCode = 500;
    res.end('Authentication failed. Check server logs.');
  }
}

async function exchangeCodeForToken(code, redirectUri) {
  const clientId = requiredEnv('GITHUB_CLIENT_ID');
  const clientSecret = requiredEnv('GITHUB_CLIENT_SECRET');
  const params = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    code,
    redirect_uri: redirectUri,
  });
  const res = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  if (!res.ok) {
    throw new Error(`Token exchange failed (${res.status})`);
  }
  const payload = await res.json();
  if (!payload.access_token) {
    throw new Error('No access token returned');
  }
  return payload.access_token;
}

async function fetchGithubProfile(token) {
  const res = await fetch('https://api.github.com/user', {
    headers: {
      Authorization: `Bearer ${token}`,
      'User-Agent': 'mycoolwebsite-admin-panel',
      Accept: 'application/vnd.github+json',
    },
  });
  if (!res.ok) {
    throw new Error(`GitHub profile request failed (${res.status})`);
  }
  return res.json();
}

function deriveBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}

function buildCallbackUrl(req) {
  const baseUrl = process.env.SITE_BASE_URL || deriveBaseUrl(req);
  return `${baseUrl.replace(/\/?$/, '')}/api/auth/callback`;
}
