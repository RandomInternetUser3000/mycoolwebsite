/* eslint-disable no-console */
const fs = require('fs/promises');
const path = require('path');
const matter = require('gray-matter');
const { marked } = require('marked');

const ROOT = path.resolve(__dirname, '..', '..');
const BLOG_DIR = path.join(ROOT, 'blog');
const CONTENT_DIR = path.join(BLOG_DIR, 'content');
const BLOG_HTML_PATH = path.join(BLOG_DIR, 'index.html');
const BLOG_OUTPUT_DIR = BLOG_DIR;
const GENERATED_DIR = path.join(BLOG_DIR, '.generated');
const FEED_PATH = path.join(BLOG_DIR, 'feed.xml');
const SITE_ORIGIN = process.env.SITE_ORIGIN || process.env.SITE_BASE_URL || 'https://coolmanyt.com';
const DEFAULT_OG_IMAGE = `${SITE_ORIGIN}/images/avatar.png`;
const WEBHOOK_CONFIG_PATH = path.join(ROOT, 'content', 'webhooks.json');

const MARKERS = {
	featured: {
		start: '<!-- BLOG_FEATURED_START -->',
		end: '<!-- BLOG_FEATURED_END -->',
	},
	grid: {
		start: '<!-- BLOG_GRID_START -->',
		end: '<!-- BLOG_GRID_END -->',
	},
	templates: {
		start: '<!-- BLOG_TEMPLATES_START -->',
		end: '<!-- BLOG_TEMPLATES_END -->',
	},
};

marked.setOptions({
	mangle: false,
	headerIds: true,
	breaks: false,
});

async function main() {
	const files = await safeReadDir(CONTENT_DIR);
	if (!files.length) {
		throw new Error('No blog content files found.');
	}

	const posts = (await Promise.all(
		files.filter((file) => file.endsWith('.md')).map(async (file) => {
			const fullPath = path.join(CONTENT_DIR, file);
			const raw = await fs.readFile(fullPath, 'utf8');
			return parsePost(file, raw);
		}),
	))
		.filter(Boolean)
		.sort((a, b) => b.date.getTime() - a.date.getTime());

	if (!posts.length) {
		throw new Error('All blog content files were empty or invalid.');
	}

	await fs.mkdir(GENERATED_DIR, { recursive: true });
	await fs.mkdir(BLOG_OUTPUT_DIR, { recursive: true });

	await updateBlogPage(posts);
	await generateStandalonePages(posts.filter((post) => post.standalone));
	await generateManifest(posts);
	await generateFeed(posts.filter((post) => post.isPublished));
	await maybeSendWebhooks(posts[0]);

	console.log(`Blog build complete (${posts.length} posts).`);
}

function parsePost(fileName, raw) {
	const { data, content } = matter(raw);
	const slug = sanitizeSlug(data.slug || path.basename(fileName, path.extname(fileName)));
	if (!slug) {
		console.warn(`Skipping ${fileName}: missing slug.`);
		return null;
	}

	const title = (data.title || slug).trim();
	const displayTitle = (data.displayTitle || title).trim();
	const tag = (data.tag || 'Update').trim();
	const summary = (data.summary || '').trim();
	const cardCta = (data.cardCta || 'Continue reading').trim();
	const shareBase = data.shareBase || 'blog/index.html';
	const readingTime = data.readingTime ? String(data.readingTime).trim() : '';
	const status = (data.status || '').trim();
	const highlights = Array.isArray(data.cardHighlights) ? data.cardHighlights : (Array.isArray(data.draftHighlights) ? data.draftHighlights : []);
	const cardImage = (data.cardImage || '').trim();
	const cardImageAlt = cardImage ? (data.cardImageAlt || displayTitle).trim() : '';
	const heroImage = (data.heroImage || '').trim();
	const heroImageAlt = heroImage ? (data.heroImageAlt || displayTitle).trim() : '';
	const ogImage = (data.ogImage || heroImage || cardImage || DEFAULT_OG_IMAGE).trim();

	const date = coerceDate(data.date || data.published || new Date());
	const updated = data.updated ? coerceDate(data.updated) : null;
	const dateDisplay = data.dateDisplay || formatDate(date);
	const iso = date.toISOString();

	const html = marked.parse(content).trim();

	const post = {
		slug,
		title,
		displayTitle,
		tag,
		date,
		dateDisplay,
		isoDate: iso,
		updated,
		readingTime,
		summary,
		cardCta,
		shareBase,
		status,
		highlights,
		contentHtml: html,
		featured: Boolean(data.featured),
		standalone: Boolean(data.standalone),
		secondaryActionLabel: data.secondaryActionLabel || '',
		secondaryActionUrl: data.secondaryActionUrl || '',
		standaloneNote: data.standaloneNote || '',
		ogImage,
		canonical: `${SITE_ORIGIN}/blog/${slug}.html`,
		cardImage,
		cardImageAlt,
		heroImage,
		heroImageAlt,
	};

	const normalizedStatus = status.toLowerCase();
	post.isPublished = !normalizedStatus || normalizedStatus === 'published';

	return post;
}

async function updateBlogPage(posts) {
	const source = await fs.readFile(BLOG_HTML_PATH, 'utf8');
	const featuredMarkup = buildFeaturedMarkup(posts.filter((post) => post.featured));
	const gridMarkup = buildGridMarkup(posts.filter((post) => !post.featured));
	const templatesMarkup = buildTemplatesMarkup(posts);

	let updated = replaceSection(source, MARKERS.featured, featuredMarkup);
	updated = replaceSection(updated, MARKERS.grid, gridMarkup);
	updated = replaceSection(updated, MARKERS.templates, templatesMarkup);

	await fs.writeFile(BLOG_HTML_PATH, updated, 'utf8');
}

function buildFeaturedMarkup(posts) {
	if (!posts.length) {
		return '<!-- No featured posts defined -->';
	}
	return posts
		.map((post) => {
			const media = buildCardMediaMarkup(post);
			const highlightList = post.highlights.length
				? `<ul>\n${post.highlights.map((item) => `                    <li>${escapeHtml(item)}</li>`).join('\n')}\n                </ul>`
				: '';
			return `            <article class="blog-featured-card" data-blog-id="${post.slug}">
                ${media}
                <div class="blog-meta">
                    <span class="tag-pill">${escapeHtml(post.tag)}</span>
                    <time datetime="${post.isoDate}">${escapeHtml(post.dateDisplay)}</time>
                </div>
                <h2>${escapeHtml(post.displayTitle)}</h2>
                <p>${escapeHtml(post.summary)}</p>
${highlightList}
                <a href="#blogReader" class="button" data-blog-open="${post.slug}">${escapeHtml(post.cardCta)}</a>
            </article>`;
		})
		.join('\n');
}

function buildGridMarkup(posts) {
	if (!posts.length) {
		return '<!-- No additional posts defined -->';
	}
	return posts
		.map((post) => {
			const media = buildCardMediaMarkup(post);
			return `            <article class="blog-card" data-blog-id="${post.slug}">
                ${media}
                <div class="blog-meta">
                    <span class="tag-pill">${escapeHtml(post.tag)}</span>
                    <time datetime="${post.isoDate}">${escapeHtml(post.dateDisplay)}</time>
                </div>
                <h3>${escapeHtml(post.displayTitle)}</h3>
                <p>${escapeHtml(post.summary)}</p>
                <a href="#blogReader" data-blog-open="${post.slug}">${escapeHtml(post.cardCta)}</a>
            </article>`;
		})
		.join('\n');
}

function buildCardMediaMarkup(post) {
	if (!post.cardImage) {
		return '';
	}
	const altText = escapeAttribute(post.cardImageAlt || post.displayTitle || post.title);
	return `<figure class="blog-card-media">
                    <img src="${escapeAttribute(post.cardImage)}" alt="${altText}" loading="lazy">
                </figure>`;
}

function buildTemplatesMarkup(posts) {
	return posts
		.map((post) => {
			const metaParts = [`<span class="tag-pill">${escapeHtml(post.tag)}</span>`, `<time datetime="${post.isoDate}">${escapeHtml(post.dateDisplay)}</time>`];
			if (post.readingTime) {
				metaParts.push(`<span>${escapeHtml(post.readingTime)}</span>`);
			}
			const articleFooterNote = post.updated
				? `Updated ${formatDate(post.updated)}`
				: `Published ${post.dateDisplay}`;
			const secondaryAction = buildTemplateSecondaryAction(post);
			const heroFigure = buildHeroFigureMarkup(post);
			const heroBlock = heroFigure ? `\n${indentHtml(heroFigure, 12)}\n` : '';
			return `    <template id="blog-template-${post.slug}">
        <article class="blog-article-wrapper">
            <header class="blog-article-header">
                <div class="blog-article-meta">
                    ${metaParts.join('\n                    ')}
                </div>
                <h1>${escapeHtml(post.title)}</h1>
                <p class="lead">${escapeHtml(post.summary)}</p>
            </header>
            <div class="blog-article-content">
${heroBlock}${indentHtml(post.contentHtml, 12)}
            </div>

            <footer class="blog-article-footer">
                <span>${escapeHtml(articleFooterNote)}</span>
                <div class="article-actions">
                    <button type="button" data-article-share data-share-slug="${post.slug}" data-share-base="${post.shareBase}" data-share-success="Link copied!">Share</button>
                    ${secondaryAction}
                </div>
            </footer>
        </article>
    </template>`;
		})
		.join('\n\n');
}


function buildTemplateSecondaryAction(post) {
	if (post.standalone) {
		return `<a href="${post.slug}.html">Open full article</a>`;
	}
	if (post.secondaryActionUrl) {
		const label = escapeHtml(post.secondaryActionLabel || 'Learn more');
		return `<a href="${escapeAttribute(post.secondaryActionUrl)}" target="_blank" rel="noopener noreferrer">${label}</a>`;
	}
	return '';
}

async function generateStandalonePages(posts) {
	if (!posts.length) {
		return;
	}

	const templatePath = path.join(BLOG_DIR, 'templates', 'blog-standalone.html');
	const template = await fs.readFile(templatePath, 'utf8');

	await Promise.all(
		posts.map(async (post) => {
			let html = template;
			html = html.replace(/{{TITLE}}/g, escapeHtml(post.title));
			html = html.replace(/{{DESCRIPTION}}/g, escapeHtml(post.summary));
			html = html.replace(/{{CANONICAL}}/g, post.canonical);
			html = html.replace(/{{OG_IMAGE}}/g, escapeAttribute(post.ogImage));
			html = html.replace(/{{PUBLISH_ISO}}/g, post.isoDate);
			html = html.replace(/{{UPDATED_ISO}}/g, post.updated ? post.updated.toISOString() : post.isoDate);
			html = html.replace(/{{TAG}}/g, escapeHtml(post.tag));
			html = html.replace(/{{DATE_DISPLAY}}/g, escapeHtml(post.dateDisplay));
			html = html.replace(/{{READING_TIME}}/g, escapeHtml(post.readingTime || ''));
			html = html.replace(/{{SUMMARY}}/g, escapeHtml(post.summary));
			html = html.replace(/{{SLUG}}/g, post.slug);
			html = html.replace(/{{SHARE_BASE}}/g, post.shareBase);
			const heroFigure = buildHeroFigureMarkup(post);
			html = html.replace(/{{HERO_MEDIA}}/, heroFigure ? `\n${indentHtml(heroFigure, 8)}\n        ` : '');
			html = html.replace(/{{CONTENT}}/, indentHtml(post.contentHtml, 8));
			const footerNote = post.standaloneNote
				? post.standaloneNote
				: post.updated
					? `Updated ${formatDate(post.updated)}`
					: `Published ${post.dateDisplay}`;
			html = html.replace(/{{FOOTER_NOTE}}/g, escapeHtml(footerNote));

			// Clean empty spans if reading time missing
			html = html.replace(/\s*<span>\s*<\/span>/g, '');

			const outPath = path.join(BLOG_OUTPUT_DIR, `${post.slug}.html`);
			await fs.writeFile(outPath, html, 'utf8');
			console.log(`Generated ${outPath}`);
		}),
	);
}

function buildHeroFigureMarkup(post) {
	if (!post.heroImage) {
		return '';
	}
	const altText = escapeAttribute(post.heroImageAlt || post.title || post.displayTitle);
	const caption = post.heroImageAlt ? `\n            <figcaption>${escapeHtml(post.heroImageAlt)}</figcaption>` : '';
	return `<figure class="blog-article-hero">
            <img src="${escapeAttribute(post.heroImage)}" alt="${altText}" loading="lazy">
            ${caption}
        </figure>`;
}

async function generateManifest(posts) {
	const manifest = posts.map((post) => ({
		slug: post.slug,
		title: post.title,
		tag: post.tag,
		date: post.isoDate,
		updated: post.updated ? post.updated.toISOString() : null,
		summary: post.summary,
		featured: post.featured,
		standalone: post.standalone,
		status: post.status,
	}));

	const manifestPath = path.join(GENERATED_DIR, 'blog-manifest.json');
	await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
}

async function generateFeed(posts) {
	if (!posts.length) {
		console.warn('Skipping RSS feed: no published posts.');
		return;
	}

	const items = posts
		.map((post) => `    <item>
      <title><![CDATA[${post.title}]]></title>
      <link>${post.canonical}</link>
      <guid>${post.canonical}</guid>
      <pubDate>${new Date(post.isoDate).toUTCString()}</pubDate>
      <description><![CDATA[${post.summary}]]></description>
    </item>`)
		.join('\n');

	const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>COOLmanYT Blog</title>
    <link>${SITE_ORIGIN}/blog/</link>
    <description>Devlogs, reflections, and creator notes from COOLmanYT.</description>
    <language>en</language>
${items}
  </channel>
</rss>\n`;

	await fs.writeFile(FEED_PATH, rss, 'utf8');
	console.log(`Generated RSS feed at ${FEED_PATH}`);
}

async function maybeSendWebhooks(post) {
	if (!post) return;
	const config = await loadWebhookConfig();
	const hooks = Array.isArray(config.webhooks) ? config.webhooks : [];
	const resolved = resolveWebhookTargets(hooks);
	if (!resolved.length && process.env.DISCORD_WEBHOOK_URL) {
		resolved.push({ id: 'DISCORD_WEBHOOK_URL', envVar: 'DISCORD_WEBHOOK_URL', url: process.env.DISCORD_WEBHOOK_URL });
	}
	if (!resolved.length) return;
	if (typeof fetch !== 'function') {
		console.warn('Webhooks skipped: fetch is not available in this Node runtime.');
		return;
	}

	const tokens = buildWebhookTokens(post);
	const message = applyTemplate(config.messageTemplate || 'New blog update: **{title}** — {summary}\n{url}', tokens);
	const embedTemplate = config.embedTemplate || null;
	const embed = embedTemplate ? applyEmbedTemplate(embedTemplate, tokens) : null;
	const payload = embed ? { content: message, embeds: [embed] } : { content: message };

	await Promise.allSettled(
		resolved.map(async (hook) => {
			try {
				await fetch(hook.url, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify(payload),
				});
				console.log(`Webhook sent: ${hook.envVar || hook.id}`);
			} catch (error) {
				console.warn(`Webhook failed for ${hook.envVar || hook.id}:`, error.message);
			}
		}),
	);
}

async function loadWebhookConfig() {
	try {
		const raw = await fs.readFile(WEBHOOK_CONFIG_PATH, 'utf8');
		return JSON.parse(raw);
	} catch (error) {
		return {};
	}
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
		out.push({ id: hook.id || envVar, envVar, url });
	});
	return out;
}

function buildWebhookTokens(post) {
	return {
		title: post.title,
		summary: post.summary,
		url: post.canonical,
		tag: post.tag,
		date: post.isoDate,
	};
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

function replaceSection(source, markers, replacement) {
	const startIndex = source.indexOf(markers.start);
	const endIndex = source.indexOf(markers.end);
	if (startIndex === -1 || endIndex === -1 || endIndex < startIndex) {
		throw new Error(`Unable to find marker range ${markers.start} -> ${markers.end}`);
	}
	const before = source.slice(0, startIndex + markers.start.length);
	const after = source.slice(endIndex);
	return `${before}\n${replacement}\n${after}`;
}

function sanitizeSlug(value) {
	return String(value || '')
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9-]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

function coerceDate(value) {
	const date = value instanceof Date ? new Date(value) : new Date(String(value));
	if (Number.isNaN(date.getTime())) {
		return new Date();
	}
	return date;
}

function formatDate(date) {
	return date.toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}

function indentHtml(html, spaces = 0) {
	const pad = ' '.repeat(spaces);
	return html
		.split('\n')
		.map((line) => (line.trim() ? `${pad}${line}` : ''))
		.join('\n');
}

function escapeHtml(value) {
	return String(value || '')
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

function escapeAttribute(value) {
	return escapeHtml(value).replace(/"/g, '&quot;');
}

async function safeReadDir(dir) {
	try {
		return await fs.readdir(dir);
	} catch (error) {
		if (error.code === 'ENOENT') {
			return [];
		}
		throw error;
	}
}

main().catch((error) => {
	console.error('Blog build failed:', error);
	process.exitCode = 1;
});
