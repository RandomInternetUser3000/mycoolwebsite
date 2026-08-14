import { getSupabasePublic } from '../lib/server/supabase.js';
import { sendJson, methodNotAllowed } from '../lib/server/http.js';
import { renderMarkdown } from '../lib/server/markdown.js';

export const config = { runtime: 'nodejs' };

/**
 * Generates a plain-text excerpt from a markdown string.
 * Strips common markdown syntax and returns the first ~150 characters.
 *
 * @param {string} markdown
 * @returns {string}
 */
function generateExcerpt(markdown) {
  if (!markdown) return '';
  const stripped = String(markdown)
    .replace(/^---[\s\S]*?---\n?/, '')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1')
    .replace(/`[^`]+`/g, '')
    .replace(/^>\s*/gm, '')
    .replace(/^[-*_]{3,}\s*$/gm, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (stripped.length <= 150) return stripped;
  const truncated = stripped.slice(0, 150);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 100 ? truncated.slice(0, lastSpace) : truncated) + '\u2026';
}

/**
 * Consolidated public content handler — dispatches based on URL path:
 *
 *   GET /api/supabase-blog/posts      → list all published blog posts
 *   GET /api/supabase-blog/post       → single published post by slug (rendered HTML)
 *   GET /api/projects/list            → list all projects
 *   GET /api/projects/detail?slug=…   → one project with optional repository docs
 */
export default async function handler(req, res) {
  const url = new URL(req.url, 'http://localhost');
  const pathname = url.pathname.replace(/\/$/, '');

  if (pathname.endsWith('/posts')) {
    return handlePosts(req, res);
  }
  if (pathname.endsWith('/post')) {
    return handlePost(req, res, url);
  }
  if (pathname.endsWith('/detail')) {
    return handleProjectDetail(req, res, url);
  }
  if (pathname.endsWith('/list') || pathname.includes('/projects')) {
    return handleProjectsList(req, res);
  }

  res.statusCode = 404;
  res.end('Not Found');
}

// ---------------------------------------------------------------------------
// GET /api/supabase-blog/posts
// ---------------------------------------------------------------------------

async function handlePosts(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from('blogs')
      .select('id, title, slug, warnings, content_markdown, created_at, updated_at, author_id')
      .eq('published', true)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching posts', error);
      return sendJson(res, 500, { error: 'Failed to fetch posts' });
    }

    const posts = (data ?? []).map((post, index) => ({
      id: post.id,
      title: post.title,
      slug: post.slug,
      warnings: post.warnings ?? [],
      excerpt: generateExcerpt(post.content_markdown),
      featured: index === 0,
      created_at: post.created_at,
      updated_at: post.updated_at,
      author_id: post.author_id,
    }));

    sendJson(res, 200, { posts });
  } catch (err) {
    console.error('Unexpected error in handlePosts', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/supabase-blog/post?slug=<slug>
// ---------------------------------------------------------------------------

async function handlePost(req, res, url) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const slug = (url.searchParams.get('slug') || '').trim();

    if (!slug) {
      return sendJson(res, 400, { error: 'slug query parameter is required' });
    }

    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from('blogs')
      .select('*')
      .eq('slug', slug)
      .eq('published', true)
      .single();

    if (error || !data) {
      return sendJson(res, 404, { error: 'Post not found' });
    }

    const contentHtml = await renderMarkdown(data.content_markdown);

    sendJson(res, 200, {
      post: {
        id: data.id,
        title: data.title,
        slug: data.slug,
        contentHtml,
        warnings: data.warnings ?? [],
        excerpt: generateExcerpt(data.content_markdown),
        created_at: data.created_at,
        updated_at: data.updated_at,
        author_id: data.author_id,
      },
    });
  } catch (err) {
    console.error('Unexpected error in handlePost', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

// ---------------------------------------------------------------------------
// GET /api/projects/list
// ---------------------------------------------------------------------------

async function handleProjectsList(req, res) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase
      .from('projects')
      .select('id, title, slug, description, url, repo_url, status, tags, featured, created_at, updated_at')
      .order('featured', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Supabase error fetching projects', error);
      return sendJson(res, 500, { error: 'Failed to fetch projects' });
    }

    sendJson(res, 200, { projects: data ?? [] });
  } catch (err) {
    console.error('Unexpected error in handleProjectsList', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

async function handleProjectDetail(req, res, url) {
  if (req.method !== 'GET') {
    return methodNotAllowed(res, ['GET']);
  }

  const slug = (url.searchParams.get('slug') || '').trim().toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) {
    return sendJson(res, 400, { error: 'A valid project slug is required.' });
  }

  try {
    const supabase = getSupabasePublic();
    const { data, error } = await supabase.from('projects').select('*').eq('slug', slug).single();
    if (error || !data) {
      return sendJson(res, 404, { error: 'Project not found.' });
    }

    const [contentHtml, repository] = await Promise.all([
      renderMarkdown(data.content_markdown || ''),
      fetchRepositoryDocuments(data.repo_url),
    ]);

    res.setHeader('Cache-Control', 'public, max-age=300, s-maxage=3600');
    sendJson(res, 200, {
      project: {
        ...data,
        image_urls: Array.isArray(data.image_urls) ? data.image_urls : [],
        contentHtml,
      },
      repository,
    });
  } catch (err) {
    console.error('Unexpected error fetching project detail', err);
    sendJson(res, 500, { error: 'Internal server error' });
  }
}

function parseGithubRepository(repoUrl) {
  try {
    const parsed = new URL(repoUrl);
    if (parsed.hostname !== 'github.com') return null;
    const [owner, repository] = parsed.pathname.split('/').filter(Boolean);
    if (!owner || !repository) return null;
    return { owner, repository: repository.replace(/\.git$/i, '') };
  } catch {
    return null;
  }
}

async function fetchRepositoryDocuments(repoUrl) {
  const repository = parseGithubRepository(repoUrl);
  if (!repository) return null;

  const baseUrl = `https://github.com/${repository.owner}/${repository.repository}`;
  const requestDocument = async (path) => {
    try {
      const response = await fetch(`https://api.github.com/repos/${repository.owner}/${repository.repository}/${path}`, {
        headers: {
          Accept: 'application/vnd.github.raw+json',
          'User-Agent': 'COOLmanYT-project-details',
        },
        signal: AbortSignal.timeout(5000),
      });
      if (!response.ok) return null;
      const markdown = await response.text();
      if (!markdown || markdown.length > 250_000) return null;
      return { markdown, html: await renderMarkdown(markdown) };
    } catch {
      return null;
    }
  };

  const [readme, licence] = await Promise.all([requestDocument('readme'), requestDocument('license')]);
  return { baseUrl, readme, licence };
}
