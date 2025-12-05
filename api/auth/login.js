import { createStateToken, buildStateCookie, requiredEnv } from '../../lib/server/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.statusCode = 405;
    res.setHeader('Allow', 'GET');
    res.end('Method Not Allowed');
    return;
  }

  const clientId = requiredEnv('GITHUB_CLIENT_ID');
  const baseUrl = process.env.SITE_BASE_URL || deriveBaseUrl(req);
  const callbackUrl = `${baseUrl.replace(/\/?$/, '')}/api/auth/callback`;
  const state = createStateToken();
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: callbackUrl,
    scope: 'read:user',
    state,
  });

  res.setHeader('Set-Cookie', buildStateCookie(state));
  res.statusCode = 302;
  res.setHeader('Location', `https://github.com/login/oauth/authorize?${params.toString()}`);
  res.end();
}

function deriveBaseUrl(req) {
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const host = req.headers.host || 'localhost:3000';
  return `${proto}://${host}`;
}
