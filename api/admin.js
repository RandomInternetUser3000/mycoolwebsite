import { requireAllowlistedSession } from '../lib/server/auth.js';
import { readJsonBody, sendJson, methodNotAllowed } from '../lib/server/http.js';
import { fetchAllowlistFromGithub, persistAllowlist } from '../lib/server/allowlist.js';
import { getSupabaseAdmin } from '../lib/server/supabase.js';
import { renderMarkdown } from '../lib/server/markdown.js';
import fs from 'fs/promises';
import path from 'path';

export const config = { runtime: 'nodejs' };

// ---------------------------------------------------------------------------
// GitHub helpers (shared by blog, site-settings, webhooks)
// ---------------------------------------------------------------------------

const OWNER = process.env.GITHUB_OWNER || 'COOLmanYT';
const REPO = process.env.GITHUB_REPO || 'mycoolwebsite';
const BRANCH = process.env.ALLOWLIST_BRANCH || 'main';
const API_BASE = 'https://api.github.com';
const COMMITTER_NAME = process.env.ALLOWLIST_COMMIT_NAME || 'COOLman Admin Bot';
const COMMITTER_EMAIL = process.env.ALLOWLIST_COMMIT_EMAIL || 'bot@coolmanyt.local';

function encodeGithubPath(filePath) {
  return filePath
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');
}

async function fetchFileFromGithub(filePath, token, options = {}) {
  const { allow404 = false, parseJson = false } = options;
  if (!token) {
    const abs = path.join(process.cwd(), filePath);
    try {
      const raw = await fs.readFile(abs, 'utf8');
      const data = parseJson ? JSON.parse(raw) : raw;
      return { data, source: 'file', sha: null, path: filePath };
    } catch (error) {
      if (allow404 && error.code === 'ENOENT') {
        return { data: null, source: 'file', sha: null, path: filePath };
      }
      throw error;
    }
  }

  const response = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeGithubPath(filePath)}?ref=${encodeURIComponent(BRANCH)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `${OWNER}-${REPO}-admin-panel`,
        Accept: 'application/vnd.github+json',
      },
    },
  );

  if (response.status === 404 && allow404) {
    return { data: null, source: 'github', sha: null, path: filePath };
  }

  if (!response.ok) {
    const err = new Error(`GitHub API error ${response.status}`);
    err.statusCode = response.status;
    throw err;
  }

  const payload = await response.json();
  const raw = Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
  const data = parseJson ? JSON.parse(raw) : raw;
  return { data, source: 'github', sha: payload.sha, path: filePath };
}

async function writeFileToGithub(filePath, content, token, sha, message) {
  const encoded = typeof content === 'string'
    ? Buffer.from(content).toString('base64')
    : Buffer.from(JSON.stringify(content, null, 2)).toString('base64');

  const body = {
    message: `chore: ${message}`,
    content: encoded,
    sha,
    branch: BRANCH,
    committer: { name: COMMITTER_NAME, email: COMMITTER_EMAIL },
  };

  const response = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeGithubPath(filePath)}`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `${OWNER}-${REPO}-admin-panel`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`GitHub update failed (${response.status}): ${errorText}`);
    err.statusCode = response.status;
    throw err;
  }
  const payload = await response.json();
  return { sha: payload.content?.sha || sha || null, path: filePath, source: 'github' };
}

async function deleteFileFromGithub(filePath, token, sha, message) {
  const body = {
    message: `chore: ${message}`,
    sha,
    branch: BRANCH,
    committer: { name: COMMITTER_NAME, email: COMMITTER_EMAIL },
  };

  const response = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeGithubPath(filePath)}`,
    {
      method: 'DELETE',
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `${OWNER}-${REPO}-admin-panel`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    const err = new Error(`GitHub delete failed (${response.status}): ${errorText}`);
    err.statusCode = response.status;
    throw err;
  }
  return { deleted: true, path: filePath };
}

// ---------------------------------------------------------------------------
// Main dispatcher
// ---------------------------------------------------------------------------

/**
 * Consolidated admin handler — all requests require an allowlisted session.
 * Dispatches based on URL path:
 *
 *   /api/admin/allowlist      → allowlist CRUD
 *   /api/admin/blog           → GitHub-file blog CRUD
 *   /api/admin/site-settings  → site settings read/write
 *   /api/admin/supabase-blog  → Supabase blog CRUD
 *   /api/admin/webhook-send   → one-off webhook send
 *   /api/admin/webhook-test   → Discord webhook test ping
 *   /api/admin/webhooks       → webhook config read/write
 */
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '');

  // Determine route segment after /api/admin/
  const segment = pathname.split('/').pop();

  switch (segment) {
    case 'allowlist':
      return routeAllowlist(req, res);
    case 'blog':
      return routeBlog(req, res, url);
    case 'site-settings':
      return routeSiteSettings(req, res);
    case 'supabase-blog':
      return routeSupabaseBlog(req, res, url);
    case 'webhook-send':
      return routeWebhookSend(req, res);
    case 'webhook-test':
      return routeWebhookTest(req, res);
    case 'webhooks':
      return routeWebhooks(req, res);
    case 'projects':
      return routeProjects(req, res);
    case 'preview':
      return routePreview(req, res);
    default:
      res.statusCode = 404;
      res.end('Not Found');
  }
}

// ===========================================================================
// PREVIEW  (/api/admin/preview) — safe Markdown rendering for the editor
// ===========================================================================

async function routePreview(req, res) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;
  if (req.method !== 'POST') {
    return methodNotAllowed(res, ['POST', 'OPTIONS']);
  }

  try {
    const body = await readJsonBody(req);
    const markdown = String(body.content_markdown ?? '');
    if (markdown.length > 200_000) {
      return sendJson(res, 413, { error: 'Preview content is too large.' });
    }
    const contentHtml = await renderMarkdown(markdown);
    sendJson(res, 200, { contentHtml });
  } catch (error) {
    console.error('Preview rendering failed', error);
    sendJson(res, 500, { error: 'Could not render preview.' });
  }
}

// ===========================================================================
// ALLOWLIST  (/api/admin/allowlist)
// ===========================================================================

async function routeAllowlist(req, res) {
  const context = await requireAllowlistedSession(req, res);
  if (!context) return;

  switch (req.method) {
    case 'GET':
      return handleAllowlistGet(res);
    case 'POST':
      return handleAllowlistAdd(req, res, context.session);
    case 'DELETE':
      return handleAllowlistRemove(req, res, context.session);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'DELETE']);
  }
}

async function handleAllowlistGet(res) {
  const allowlist = await fetchAllowlistFromGithub();
  sendJson(res, 200, {
    users: allowlist.users,
    canEdit: Boolean(process.env.ALLOWLIST_GITHUB_TOKEN),
    source: allowlist.source,
  });
}

async function handleAllowlistAdd(req, res, session) {
  if (!process.env.ALLOWLIST_GITHUB_TOKEN) {
    return sendJson(res, 501, { error: 'Allow list editing is not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
  }
  try {
    const body = await readJsonBody(req);
    const username = sanitizeUsername(body.username);
    if (!username) return sendJson(res, 400, { error: 'username is required' });

    const allowlist = await fetchAllowlistFromGithub();
    if (allowlist.users.map((u) => u.toLowerCase()).includes(username.toLowerCase())) {
      return sendJson(res, 200, { users: allowlist.users, message: 'User already in allow list.' });
    }
    allowlist.users.push(username);
    const updated = await persistAllowlist(allowlist.users, session.login);
    sendJson(res, 200, { users: updated.users, message: `${username} added.` });
  } catch (error) {
    console.error('Allowlist add failed', error);
    sendJson(res, 500, { error: 'Failed to update allow list.' });
  }
}

async function handleAllowlistRemove(req, res, session) {
  if (!process.env.ALLOWLIST_GITHUB_TOKEN) {
    return sendJson(res, 501, { error: 'Allow list editing is not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
  }
  try {
    const body = await readJsonBody(req);
    const username = sanitizeUsername(body.username);
    if (!username) return sendJson(res, 400, { error: 'username is required' });

    const allowlist = await fetchAllowlistFromGithub();
    const filtered = allowlist.users.filter((u) => u.toLowerCase() !== username.toLowerCase());
    if (filtered.length === allowlist.users.length) {
      return sendJson(res, 404, { error: 'User not found on allow list.' });
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

// ===========================================================================
// GITHUB BLOG  (/api/admin/blog)
// ===========================================================================

const BLOG_CONTENT_ROOT = 'blog/content';
const BLOG_MANIFEST_PATH = 'blog/.generated/blog-manifest.json';
const BLOG_STANDALONE_ROOT = 'blog';

function validateSlug(slug) {
  const trimmed = (slug || '').toString().trim();
  if (!trimmed) throw Object.assign(new Error('Slug is required'), { statusCode: 400 });
  if (!/^[a-z0-9-]+$/.test(trimmed)) {
    throw Object.assign(new Error('Slug must use lowercase letters, numbers, and hyphens only'), { statusCode: 400 });
  }
  return trimmed;
}

async function routeBlog(req, res, url) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  const token = process.env.ALLOWLIST_GITHUB_TOKEN;

  switch (req.method) {
    case 'GET':
      return handleBlogGet(req, res, token, url);
    case 'POST':
    case 'PUT':
      return handleBlogUpsert(req, res, token);
    case 'DELETE':
      return handleBlogDelete(req, res, token, url);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
  }
}

async function handleBlogGet(req, res, token, url) {
  try {
    const slug = validateSlug(url.searchParams.get('slug'));
    const filePath = `${BLOG_CONTENT_ROOT}/${slug}.md`;
    const payload = await fetchFileFromGithub(filePath, token);
    if (!payload.data) {
      return sendJson(res, 404, { error: 'Post not found' });
    }
    sendJson(res, 200, { slug, content: payload.data, sha: payload.sha, source: payload.source, path: filePath });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to load post' });
  }
}

async function handleBlogUpsert(req, res, token) {
  if (!token) {
    return sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
  }
  try {
    const body = await readJsonBody(req);
    const slug = validateSlug(body.slug);
    const content = (body.content || '').toString();
    if (!content.trim()) throw Object.assign(new Error('Content cannot be empty'), { statusCode: 400 });

    const filePath = `${BLOG_CONTENT_ROOT}/${slug}.md`;
    const current = await fetchFileFromGithub(filePath, token, { allow404: true });
    const sha = body.sha || current.sha || undefined;
    const writeResult = await writeFileToGithub(filePath, content, token, sha, `update blog post: ${slug}`);
    sendJson(res, 200, { slug, sha: writeResult.sha, path: writeResult.path, source: writeResult.source });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to save post' });
  }
}

async function handleBlogDelete(req, res, token, url) {
  if (!token) {
    return sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
  }
  try {
    const body = await readJsonBody(req);
    const slug = validateSlug(body.slug || url.searchParams.get('slug'));
    const contentPath = `${BLOG_CONTENT_ROOT}/${slug}.md`;
    const standalonePath = `${BLOG_STANDALONE_ROOT}/${slug}.html`;
    const result = { slug, deletedContent: false, removedFromManifest: false, deletedStandalone: false };

    const current = await fetchFileFromGithub(contentPath, token, { allow404: true });
    if (current.sha) {
      await deleteFileFromGithub(contentPath, token, current.sha, `delete blog post: ${slug}`);
      result.deletedContent = true;
    }

    const manifest = await fetchFileFromGithub(BLOG_MANIFEST_PATH, token, { allow404: true });
    if (manifest.data) {
      try {
        const parsed = JSON.parse(manifest.data);
        const posts = Array.isArray(parsed.posts) ? parsed.posts : Array.isArray(parsed) ? parsed : [];
        const filtered = posts.filter((post) => (post.slug || '').toLowerCase() !== slug.toLowerCase());
        if (filtered.length !== posts.length) {
          const updatedManifest = Array.isArray(parsed) ? filtered : { ...parsed, posts: filtered };
          await writeFileToGithub(
            BLOG_MANIFEST_PATH,
            `${JSON.stringify(updatedManifest, null, 2)}\n`,
            token,
            manifest.sha || undefined,
            `remove blog manifest entry: ${slug}`,
          );
          result.removedFromManifest = true;
        }
      } catch (err) {
        console.warn('Manifest parse failed during delete', err);
      }
    }

    const standalone = await fetchFileFromGithub(standalonePath, token, { allow404: true });
    if (standalone.sha) {
      await deleteFileFromGithub(standalonePath, token, standalone.sha, `delete standalone blog page: ${slug}`);
      result.deletedStandalone = true;
    }

    if (!result.deletedContent && !result.removedFromManifest && !result.deletedStandalone) {
      const err = new Error('No matching blog content, manifest entry, or standalone page found');
      err.statusCode = 404;
      throw err;
    }

    sendJson(res, 200, { ...result, path: contentPath });
  } catch (error) {
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to delete post' });
  }
}

// ===========================================================================
// SITE SETTINGS  (/api/admin/site-settings)
// ===========================================================================

const SITE_SETTINGS_PATH = 'content/site-settings.json';

async function routeSiteSettings(req, res) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  const token = process.env.ALLOWLIST_GITHUB_TOKEN;

  switch (req.method) {
    case 'GET':
      return handleSiteSettingsGet(res, token);
    case 'POST':
    case 'PUT':
      return handleSiteSettingsUpdate(req, res, token);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'OPTIONS']);
  }
}

async function handleSiteSettingsGet(res, token) {
  try {
    const payload = await fetchFileFromGithub(SITE_SETTINGS_PATH, token, { parseJson: true });
    sendJson(res, 200, payload);
  } catch (error) {
    console.error('Site settings fetch failed', error);
    sendJson(res, 500, { error: 'Failed to load site settings.' });
  }
}

async function handleSiteSettingsUpdate(req, res, token) {
  if (!token) {
    return sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
  }
  try {
    const body = await readJsonBody(req);
    const cleaned = sanitizeSiteSettings(body || {});
    const current = await fetchFileFromGithub(SITE_SETTINGS_PATH, token, { parseJson: true });
    const next = { ...current.data, ...cleaned };
    const updated = await writeFileToGithub(SITE_SETTINGS_PATH, next, token, current.sha, 'site settings update');
    sendJson(res, 200, { data: next, source: updated.source });
  } catch (error) {
    console.error('Site settings update failed', error);
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to update site settings.' });
  }
}

const SITE_SETTINGS_STRING_FIELDS = ['releaseCountdownTarget', 'bannerText', 'bannerLink', 'bannerButtonText', 'footerText', 'footerHtml', 'countdownHeading', 'countdownNote'];
const SITE_SETTINGS_BOOL_FIELDS = ['bannerEnabled', 'countdownEnabled'];

function sanitizeSiteSettings(input) {
  const next = {};
  SITE_SETTINGS_STRING_FIELDS.forEach((key) => { if (typeof input[key] === 'string') next[key] = input[key]; });
  SITE_SETTINGS_BOOL_FIELDS.forEach((key) => { if (typeof input[key] === 'boolean') next[key] = input[key]; });
  return next;
}

// ===========================================================================
// SUPABASE BLOG  (/api/admin/supabase-blog)
// ===========================================================================

async function routeSupabaseBlog(req, res, url) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  switch (req.method) {
    case 'GET':
      return handleSupabaseBlogGet(req, res, url);
    case 'POST':
      return handleSupabaseBlogCreate(req, res);
    case 'PUT':
      return handleSupabaseBlogUpdate(req, res);
    case 'DELETE':
      return handleSupabaseBlogDelete(req, res);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
  }
}

async function handleSupabaseBlogGet(req, res, url) {
  try {
    const supabase = getSupabaseAdmin();
    const slug = (url.searchParams.get('slug') || '').trim();

    if (slug) {
      const { data, error } = await supabase.from('blogs').select('*').eq('slug', slug).single();
      if (error || !data) return sendJson(res, 404, { error: 'Post not found' });
      return sendJson(res, 200, { post: data });
    }

    const { data, error } = await supabase
      .from('blogs')
      .select('id, title, slug, warnings, published, created_at, updated_at')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase list error', error);
      return sendJson(res, 500, { error: 'Failed to fetch posts' });
    }
    sendJson(res, 200, { posts: data ?? [] });
  } catch (err) {
    console.error('Admin supabase blog GET failed', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

async function handleSupabaseBlogCreate(req, res) {
  try {
    const body = await readJsonBody(req);
    const { title, slug, content_markdown, warnings, published } = body;

    if (!title || !slug || !content_markdown) {
      return sendJson(res, 400, { error: 'title, slug, and content_markdown are required' });
    }
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return sendJson(res, 400, { error: 'Slug must use lowercase letters, numbers, and hyphens only' });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('blogs')
      .insert({
        title: String(title).trim(),
        slug: String(slug).trim(),
        content_markdown: String(content_markdown),
        warnings: Array.isArray(warnings) ? warnings : null,
        published: Boolean(published),
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase insert error', error);
      if (error.code === '23505') return sendJson(res, 409, { error: 'A post with that slug already exists' });
      return sendJson(res, 500, { error: 'Failed to create post' });
    }
    sendJson(res, 201, { post: data });
  } catch (err) {
    console.error('Admin supabase blog POST failed', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

async function handleSupabaseBlogUpdate(req, res) {
  try {
    const body = await readJsonBody(req);
    const { id, title, slug, content_markdown, warnings, published } = body;

    if (!id) return sendJson(res, 400, { error: 'id is required' });
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      return sendJson(res, 400, { error: 'Slug must use lowercase letters, numbers, and hyphens only' });
    }

    const updates = {};
    if (title !== undefined) updates.title = String(title).trim();
    if (slug !== undefined) updates.slug = String(slug).trim();
    if (content_markdown !== undefined) updates.content_markdown = String(content_markdown);
    if (warnings !== undefined) updates.warnings = Array.isArray(warnings) ? warnings : null;
    if (published !== undefined) updates.published = Boolean(published);

    if (Object.keys(updates).length === 0) return sendJson(res, 400, { error: 'No fields to update' });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from('blogs').update(updates).eq('id', id).select().single();

    if (error) {
      console.error('Supabase update error', error);
      if (error.code === '23505') return sendJson(res, 409, { error: 'A post with that slug already exists' });
      return sendJson(res, 500, { error: 'Failed to update post' });
    }
    if (!data) return sendJson(res, 404, { error: 'Post not found' });
    sendJson(res, 200, { post: data });
  } catch (err) {
    console.error('Admin supabase blog PUT failed', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

async function handleSupabaseBlogDelete(req, res) {
  try {
    const body = await readJsonBody(req);
    const { id } = body;
    if (!id) return sendJson(res, 400, { error: 'id is required' });

    const supabase = getSupabaseAdmin();
    const { error, count } = await supabase.from('blogs').delete({ count: 'exact' }).eq('id', id);

    if (error) {
      console.error('Supabase delete error', error);
      return sendJson(res, 500, { error: 'Failed to delete post' });
    }
    if (count === 0) return sendJson(res, 404, { error: 'Post not found' });
    sendJson(res, 200, { deleted: true, id });
  } catch (err) {
    console.error('Admin supabase blog DELETE failed', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

// ===========================================================================
// WEBHOOK SEND  (/api/admin/webhook-send)
// ===========================================================================

const WEBHOOKS_CONFIG_PATH = 'content/webhooks.json';

async function fetchWebhooksConfig(token) {
  if (!token) {
    const configPath = path.join(process.cwd(), WEBHOOKS_CONFIG_PATH);
    try {
      const raw = await fs.readFile(configPath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') return { webhooks: [] };
      throw error;
    }
  }

  const response = await fetch(
    `${API_BASE}/repos/${OWNER}/${REPO}/contents/${encodeURIComponent(WEBHOOKS_CONFIG_PATH)}?ref=${encodeURIComponent(BRANCH)}`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        'User-Agent': `${OWNER}-${REPO}-admin-panel`,
        Accept: 'application/vnd.github+json',
      },
    },
  );
  if (response.status === 404) return { webhooks: [] };
  if (!response.ok) throw new Error(`GitHub API error ${response.status}`);
  const payload = await response.json();
  const raw = Buffer.from(payload.content, payload.encoding || 'base64').toString('utf8');
  return JSON.parse(raw);
}

function resolveWebhookTargets(list) {
  const seen = new Set();
  const out = [];
  list.forEach((hook) => {
    const envVar = (hook.envVar || hook.env || '').toString().trim();
    if (!envVar) return;
    const url = process.env[envVar];
    if (!url || seen.has(url)) return;
    seen.add(url);
    out.push({ id: hook.id?.toString?.() || envVar, envVar, url });
  });
  return out;
}

async function sendWebhookRequest(url, message, embed) {
  const body = embed ? { content: message, embeds: [embed] } : { content: message };
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    const err = new Error(`Webhook responded with ${response.status} ${errText}`.trim());
    err.statusCode = response.status;
    throw err;
  }
}

async function routeWebhookSend(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);

  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  try {
    const body = await readJsonBody(req);
    const message = (body.message || '').toString().trim();
    const embed = body.embed && typeof body.embed === 'object' ? body.embed : undefined;
    const ids = Array.isArray(body.ids) ? body.ids.map((v) => v.toString()) : [];
    if (!message) throw Object.assign(new Error('Message is required'), { statusCode: 400 });

    const token = process.env.ALLOWLIST_GITHUB_TOKEN;
    const configPayload = await fetchWebhooksConfig(token);
    const available = Array.isArray(configPayload.webhooks) ? configPayload.webhooks : [];
    const requested = ids.length ? available.filter((w) => ids.includes(String(w.id))) : available;
    const targets = resolveWebhookTargets(requested);

    if (!targets.length && process.env.DISCORD_WEBHOOK_URL) {
      targets.push({ id: 'DISCORD_WEBHOOK_URL', envVar: 'DISCORD_WEBHOOK_URL', url: process.env.DISCORD_WEBHOOK_URL });
    }
    if (!targets.length) {
      throw Object.assign(new Error('No webhook environment variables resolved to URLs.'), { statusCode: 400 });
    }

    const results = await Promise.all(
      targets.map(async (hook) => {
        try {
          await sendWebhookRequest(hook.url, message, embed);
          return { id: hook.id, envVar: hook.envVar, ok: true };
        } catch (error) {
          return { id: hook.id, envVar: hook.envVar, ok: false, error: error.message };
        }
      }),
    );

    const sent = results.filter((r) => r.ok).length;
    const failed = results.filter((r) => !r.ok);
    sendJson(res, failed.length === results.length ? 502 : 200, { sent, failed });
  } catch (error) {
    sendJson(res, error.statusCode || 500, { error: error.message || 'Failed to send webhook.' });
  }
}

// ===========================================================================
// WEBHOOK TEST  (/api/admin/webhook-test)
// ===========================================================================

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

function buildWebhookTestPayload(session, req, config = {}) {
  const baseUrl = (process.env.SITE_BASE_URL || deriveBaseUrl(req)).replace(/\/$/, '');
  const tokens = {
    admin: session.login || 'unknown',
    site: baseUrl,
    title: 'Test Ping',
    summary: 'Manual webhook test from admin panel',
    url: baseUrl,
    tag: 'test',
    date: new Date().toISOString(),
  };
  const template = config.messageTemplate || '🔔 Blog webhook test ping from {admin} at {site}';
  const content = applyTemplate(template, tokens);
  const embedTemplate = config.embedTemplate || {
    title: 'COOLmanYT Blog · Webhook test',
    description: 'Manual test triggered by {admin}',
    color: 0x5865f2,
    footer: { text: 'Triggered via admin panel' },
  };
  const embed = applyEmbedTemplate(embedTemplate, tokens);
  return embed ? { content, embeds: [embed] } : { content };
}

function resolveWebhookFromEnv(config = {}) {
  const list = Array.isArray(config.webhooks) ? config.webhooks : [];
  for (const hook of list) {
    const envVar = (hook.envVar || hook.env || '').toString().trim();
    if (!envVar) continue;
    const url = process.env[envVar];
    if (url) return { envVar, url };
  }
  return null;
}

async function routeWebhookTest(req, res) {
  if (req.method !== 'POST') return methodNotAllowed(res, ['POST', 'OPTIONS']);

  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  const config = await (async () => {
    try {
      const configPath = path.join(process.cwd(), WEBHOOKS_CONFIG_PATH);
      const raw = await fs.readFile(configPath, 'utf8');
      return JSON.parse(raw);
    } catch (_) {
      return {};
    }
  })();

  const targetWebhook = resolveWebhookFromEnv(config);
  const webhookUrl = targetWebhook?.url || process.env.DISCORD_WEBHOOK_URL;
  if (!webhookUrl) {
    return sendJson(res, 501, { error: 'No webhook configured.' });
  }

  try {
    const payload = buildWebhookTestPayload(auth.session, req, config);
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    const text = await response.text().catch(() => '');
    if (!response.ok) {
      const error = new Error(`Discord webhook rejected the request (${response.status}).`);
      error.statusCode = response.status;
      throw error;
    }
    sendJson(res, 200, { message: 'Webhook ping sent to Discord.' });
  } catch (error) {
    console.error('Webhook test failed', error);
    sendJson(res, error.statusCode || 502, { error: error.message || 'Failed to deliver webhook ping.' });
  }
}

// ===========================================================================
// WEBHOOKS CONFIG  (/api/admin/webhooks)
// ===========================================================================

function defaultWebhookConfig() {
  return {
    messageTemplate: 'New blog update: **{title}** — {summary}\n{url}',
    embedTemplate: { title: '{title}', description: '{summary}\n{url}', color: 5793266 },
    webhooks: [],
  };
}

function sanitizeWebhookConfig(input) {
  const out = {};
  if (typeof input.messageTemplate === 'string') out.messageTemplate = input.messageTemplate;
  if (input.embedTemplate && typeof input.embedTemplate === 'object') out.embedTemplate = input.embedTemplate;
  if (Array.isArray(input.webhooks)) {
    out.webhooks = input.webhooks
      .map((hook) => {
        const envVar = typeof hook.envVar === 'string' ? hook.envVar.trim() : '';
        if (!envVar) return null;
        const id = (hook.id || generateId()).toString();
        return { id, envVar };
      })
      .filter(Boolean);
  }
  return out;
}

function generateId() {
  return Math.random().toString(36).slice(2, 10);
}

async function routeWebhooks(req, res) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  const token = process.env.ALLOWLIST_GITHUB_TOKEN;

  switch (req.method) {
    case 'GET':
      return handleWebhooksGet(res, token);
    case 'POST':
    case 'PUT':
      return handleWebhooksUpdate(req, res, token);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'OPTIONS']);
  }
}

async function handleWebhooksGet(res, token) {
  try {
    const payload = await fetchFileFromGithub(WEBHOOKS_CONFIG_PATH, token, { allow404: true, parseJson: true });
    const data = { ...defaultWebhookConfig(), ...(payload.data || {}) };
    sendJson(res, 200, { data, source: payload.source || 'file' });
  } catch (error) {
    console.error('Webhooks fetch failed', error);
    sendJson(res, 500, { error: 'Failed to load webhooks config.' });
  }
}

async function handleWebhooksUpdate(req, res, token) {
  if (!token) {
    return sendJson(res, 501, { error: 'Editing not configured. Set ALLOWLIST_GITHUB_TOKEN.' });
  }
  try {
    const body = await readJsonBody(req);
    const cleaned = sanitizeWebhookConfig(body || {});
    const current = await fetchFileFromGithub(WEBHOOKS_CONFIG_PATH, token, { allow404: true, parseJson: true });
    const next = { ...defaultWebhookConfig(), ...(current.data || {}), ...cleaned };
    const updated = await writeFileToGithub(WEBHOOKS_CONFIG_PATH, next, token, current.sha, 'update webhooks config');
    sendJson(res, 200, { data: next, source: updated.source });
  } catch (error) {
    console.error('Webhooks update failed', error);
    const status = error.statusCode || 500;
    sendJson(res, status, { error: error.message || 'Failed to update webhooks.' });
  }
}

// ===========================================================================
// PROJECTS  (/api/admin/projects)  — Supabase backed
// ===========================================================================

function sanitizeProject(input) {
  const p = {};
  if (typeof input.title === 'string') p.title = input.title.trim();
  if (typeof input.slug === 'string') {
    const slug = input.slug.trim().toLowerCase();
    if (slug && !/^[a-z0-9-]+$/.test(slug)) {
      throw Object.assign(new Error('Project slug must use lowercase letters, numbers, and hyphens only.'), { statusCode: 400 });
    }
    p.slug = slug || null;
  }
  if (typeof input.description === 'string') p.description = input.description.trim();
  if (typeof input.content_markdown === 'string') p.content_markdown = input.content_markdown.trim();
  if (typeof input.url === 'string') p.url = input.url.trim();
  if (typeof input.repo_url === 'string') p.repo_url = input.repo_url.trim();
  // Support legacy camelCase field from admin form
  if (typeof input.repoUrl === 'string' && !input.repo_url) p.repo_url = input.repoUrl.trim();
  if (typeof input.status === 'string') p.status = input.status.trim();
  if (typeof input.featured === 'boolean') p.featured = input.featured;
  if (Array.isArray(input.tags)) {
    p.tags = input.tags.map((t) => String(t).trim()).filter(Boolean);
  }
  if (Array.isArray(input.image_urls)) {
    p.image_urls = input.image_urls
      .map((url) => String(url).trim())
      .filter((url) => /^https?:\/\//i.test(url))
      .slice(0, 12);
  }
  return p;
}

async function routeProjects(req, res) {
  const auth = await requireAllowlistedSession(req, res);
  if (!auth) return;

  switch (req.method) {
    case 'GET':
      return handleProjectsGet(res);
    case 'POST':
      return handleProjectsCreate(req, res);
    case 'PUT':
      return handleProjectsUpdate(req, res);
    case 'DELETE':
      return handleProjectsDelete(req, res);
    default:
      return methodNotAllowed(res, ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']);
  }
}

async function handleProjectsGet(res) {
  try {
    // getSupabaseAdmin is already imported at the top of this module
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      console.error('Supabase error fetching projects', error);
      return sendJson(res, 500, { error: 'Failed to fetch projects.' });
    }
    sendJson(res, 200, { projects: data ?? [] });
  } catch (err) {
    console.error('Projects GET failed', err);
    sendJson(res, 500, { error: 'Failed to load projects.' });
  }
}

async function handleProjectsCreate(req, res) {
  try {
    const body = await readJsonBody(req);
    if (!body.title || !String(body.title).trim() || !body.slug || !String(body.slug).trim()) {
      return sendJson(res, 400, { error: 'title and slug are required' });
    }
    const project = sanitizeProject(body);
    // getSupabaseAdmin is already imported at the top of this module
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('projects')
      .insert(project)
      .select()
      .single();
    if (error) {
      console.error('Supabase error creating project', error);
      return sendJson(res, 500, { error: error.message || 'Failed to create project.' });
    }
    sendJson(res, 201, { project: data });
  } catch (err) {
    console.error('Projects POST failed', err);
    sendJson(res, 500, { error: err.message || 'Failed to create project.' });
  }
}

async function handleProjectsUpdate(req, res) {
  try {
    const body = await readJsonBody(req);
    if (!body.id) return sendJson(res, 400, { error: 'id is required' });
    const updates = sanitizeProject(body);
    // getSupabaseAdmin is already imported at the top of this module
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('projects')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();
    if (error) {
      console.error('Supabase error updating project', error);
      return sendJson(res, error.code === 'PGRST116' ? 404 : 500, { error: error.message || 'Failed to update project.' });
    }
    sendJson(res, 200, { project: data });
  } catch (err) {
    console.error('Projects PUT failed', err);
    sendJson(res, 500, { error: err.message || 'Failed to update project.' });
  }
}

async function handleProjectsDelete(req, res) {
  try {
    const body = await readJsonBody(req);
    if (!body.id) return sendJson(res, 400, { error: 'id is required' });
    // getSupabaseAdmin is already imported at the top of this module
    const supabase = getSupabaseAdmin();
    const { error, count } = await supabase
      .from('projects')
      .delete({ count: 'exact' })
      .eq('id', body.id);
    if (error) {
      console.error('Supabase error deleting project', error);
      return sendJson(res, 500, { error: error.message || 'Failed to delete project.' });
    }
    if (count === 0) return sendJson(res, 404, { error: 'Project not found.' });
    sendJson(res, 200, { deleted: true, id: body.id });
  } catch (err) {
    console.error('Projects DELETE failed', err);
    sendJson(res, 500, { error: err.message || 'Failed to delete project.' });
  }
}
