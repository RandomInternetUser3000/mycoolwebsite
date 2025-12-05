import { clearSessionCookie, clearStateCookie } from '../../lib/server/auth.js';

export const config = { runtime: 'nodejs' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.statusCode = 405;
    res.setHeader('Allow', 'POST');
    res.end('Method Not Allowed');
    return;
  }

  res.setHeader('Set-Cookie', [clearSessionCookie(), clearStateCookie()]);
  res.statusCode = 204;
  res.end();
}
