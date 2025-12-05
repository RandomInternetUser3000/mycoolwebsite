import crypto from 'node:crypto';

const SESSION_COOKIE = 'coolman_session';
const STATE_COOKIE = 'coolman_state';
const COOKIE_BASE_OPTS = {
  path: '/',
  httpOnly: true,
  secure: true,
  sameSite: 'Lax',
};

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseCookies(header = '') {
  return header.split(';').reduce((acc, pair) => {
    const [key, ...rest] = pair.trim().split('=');
    if (!key) return acc;
    acc[key] = decodeURIComponent(rest.join('=') || '');
    return acc;
  }, {});
}

function serializeCookie(name, value, options = {}) {
  const opts = { ...COOKIE_BASE_OPTS, ...options };
  const segments = [`${name}=${value ?? ''}`];
  if (opts.maxAge !== undefined) {
    segments.push(`Max-Age=${opts.maxAge}`);
  }
  if (opts.expires) {
    segments.push(`Expires=${opts.expires.toUTCString()}`);
  }
  if (opts.path) {
    segments.push(`Path=${opts.path}`);
  }
  if (opts.domain) {
    segments.push(`Domain=${opts.domain}`);
  }
  if (opts.sameSite) {
    segments.push(`SameSite=${opts.sameSite}`);
  }
  if (opts.secure) {
    segments.push('Secure');
  }
  if (opts.httpOnly) {
    segments.push('HttpOnly');
  }
  return segments.join('; ');
}

function getSigningSecret() {
  return requiredEnv('SESSION_SECRET');
}

function signValue(value) {
  const secret = getSigningSecret();
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(value);
  return hmac.digest('base64url');
}

function encodeSession(payload) {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = signValue(data);
  return `${data}.${signature}`;
}

function decodeSession(token) {
  if (!token) return null;
  const [data, signature] = token.split('.');
  if (!data || !signature) return null;
  const expected = signValue(data);
  const bufSig = Buffer.from(signature);
  const bufExp = Buffer.from(expected);
  if (bufSig.length !== bufExp.length) {
    return null;
  }
  const safe = crypto.timingSafeEqual(bufSig, bufExp);
  if (!safe) return null;
  try {
    const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch (error) {
    return null;
  }
}

function createStateToken() {
  return crypto.randomBytes(32).toString('base64url');
}

function buildStateCookie(state, maxAge = 600) {
  const signed = encodeSession({ state, exp: Date.now() + maxAge * 1000 });
  return serializeCookie(STATE_COOKIE, signed, { maxAge });
}

function verifyStateCookie(state, cookieHeader = '') {
  if (!state) return false;
  const cookies = parseCookies(cookieHeader);
  const stored = cookies[STATE_COOKIE];
  const decoded = decodeSession(stored);
  if (!decoded || decoded.state !== state) {
    return false;
  }
  return true;
}

function buildSessionCookie(user, options = {}) {
  const maxAge = options.maxAge ?? 60 * 60 * 24 * 7; // one week
  const payload = {
    login: user.login,
    name: user.name ?? user.login,
    avatarUrl: user.avatar_url ?? user.avatarUrl ?? null,
    exp: Date.now() + maxAge * 1000,
    roles: user.roles ?? ['admin'],
  };
  const token = encodeSession(payload);
  return serializeCookie(SESSION_COOKIE, token, { maxAge });
}

function clearSessionCookie() {
  return serializeCookie(SESSION_COOKIE, '', { maxAge: 0 });
}

function clearStateCookie() {
  return serializeCookie(STATE_COOKIE, '', { maxAge: 0 });
}

function getSessionFromRequest(req) {
  const cookieHeader = req.headers?.cookie ?? req.headers?.Cookie ?? '';
  const cookies = parseCookies(cookieHeader);
  return decodeSession(cookies[SESSION_COOKIE]);
}

export {
  SESSION_COOKIE,
  STATE_COOKIE,
  requiredEnv,
  parseCookies,
  serializeCookie,
  createStateToken,
  verifyStateCookie,
  buildStateCookie,
  buildSessionCookie,
  clearSessionCookie,
  clearStateCookie,
  getSessionFromRequest,
};
