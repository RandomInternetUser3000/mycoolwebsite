# My Personal Website

This repo powers my public site: a static, no-build playground for project write-ups, devlogs, embeds, and ways to get in touch. Everything ships as plain HTML, modern CSS, and one JavaScript file so deploys stay instant and debugging stays human.

## Highlights
- Accessible navigation with skip links, scrollable pill menus, strong focus outlines, and reduced-motion safeguards.
- Release countdown and "My Favourite Songs" cards that now share the same glassy gradients in dark and light themes.
- Dynamic "Latest Upload" panel that fetches the newest YouTube video via channel handle/ID fallbacks, thumbnails, stats, and durations.
- Lazy-loaded heavy modules in `script.js`, so project/blog viewers, share buttons, and analytics logic only run when the relevant DOM exists.
- Formspree-powered contact form with inline status messaging, automatic fallback when CORS blocks AJAX submissions, and a custom thank-you redirect (no Formspree default screen).
- Structured metadata (Open Graph, Twitter, JSON-LD) across every page to keep previews and SEO tidy.
- Fully functioning `admin.html` with GitHub OAuth and lots of powerful powers.

## Repository Layout

```
mycoolwebsite/
├── index.html                   # Homepage + hero, latest video, countdown, playlist
├── about.html                   # Meet-the-creator page (paired with about.css)
├── projects.html                # Project gallery + inline viewer templates
├── blog/index.html              # Blog listing + inline reader templates
├── contact.html                 # Contact channels + Formspree form
├── gallery.html                 # Screenshot grid + light narrative
├── style.css                    # Global styles + component systems
├── script.js                    # Theme toggle, countdown, lazy initialisers, forms
├── about.css                    # Extra styles for /about
├── contact.css                  # Extra styles for /contact
├── blog/                        # Everything blog-related lives here
│   ├── index.html               # Blog landing page + inline reader templates
│   ├── feed.xml                 # RSS feed emitted by the build step
│   ├── content/                 # Markdown sources for every post
│   ├── templates/
│   │   └── blog-standalone.html # Permalink shell used for standalone pages
│   ├── scripts/
│   │   └── build-blog.js        # Static build pipeline for posts/templates
│   ├── .generated/
│   │   └── blog-manifest.json   # Machine-readable list of posts
│   └── social-media-ban.html    # Protest essay with refreshed relative paths
├── projects/                    # Project deep dives (direct links)
│   ├── project-aurora-arena.html
│   ├── project-personal-website.html
│   └── project-shortform-toolkit.html
├── images/                      # Icons, avatars, placeholders
├── content/
│   └── site-settings.json       # Release countdown + other sitewide knobs
└── README.md                    # You are here :D
```

> Legacy root-level `project-*.html` and `social-media-ban.html` files were relocated into `projects/` and `blog/`. Update bookmarks if you had them saved.

## Local Development

1. Clone the repo and open it in VS Code (or your editor of choice).
2. Serve the files with any static server so relative paths work:
   - VS Code Live Server
   - `npx serve`
   - `python -m http.server`
3. Visit `http://localhost:PORT/index.html`, edit, and refresh. No build pipeline required.

> Tip: When testing the contact form locally, Formspree will require a CAPTCHA redirect. The script flashes a "Redirecting to Formspree..." message and then posts the fallback form automatically.

## Updating Content

- Latest YouTube upload — update the `data-channel-user` (or optional `data-channel-id`) on the `[data-latest-video]` block in `index.html`. The script resolves handles, IDs, or legacy usernames automatically.
- Blog posts — write markdown with front matter inside `blog/content/*.md`, then run `npm run build:blog` to regenerate `blog/index.html`, `blog/feed.xml`, `blog/.generated/blog-manifest.json`, and every standalone page derived from `blog/templates/blog-standalone.html`.
- Projects — extend `projects.html` with new cards + `<template>` blocks, and drop long-form write-ups into `projects/your-page.html` so you can share direct URLs.
- Social buttons — edit the `.social-links` clusters on each page (plus the hero footer). Icons live under `images/`; remember alt text. External links automatically get Material Symbols for “open in new” vs “external” based on target/protocol.
- Images — drop optimized assets into `images/` and reference them relatively (`images/avatar.png`).

## Blog Workflow

1. `npm install` (first run only) — pulls `gray-matter` + `marked` for the builder.
2. Draft or update markdown under `blog/content/` with the usual front matter (`title`, `slug`, `published`, `previewImage`, `shareBase`, etc.).
3. Tweak `blog/templates/blog-standalone.html` if the outer chrome needs love.
4. Run `npm run build:blog` — this executes `blog/scripts/build-blog.js`, rewriting the featured/grid sections inside `blog/index.html`, regenerating standalone HTML files, refreshing `blog/feed.xml`, and updating `blog/.generated/blog-manifest.json`.
5. Review the generated files (especially `blog/index.html` diffs) before committing so you can keep layout tweaks plus content in sync.

## Distribution & Notifications

- **RSS feed** — lives at `/blog/feed.xml`. Readers and aggregators can subscribe directly, and the admin panel surfaces a copy/open shortcut under the “Distribution” card.
- **Discord webhook** — set `DISCORD_WEBHOOK_URL` in your hosting environment to broadcast freshly built blog posts and to power the admin “Send test ping” button. The serverless handler lives at `/api/admin/webhook-test` and validates auth before sending a structured embed so you can confirm delivery without pushing a full build.
- **Fail-safes** — if the webhook isn’t configured, the admin UI disables the test button, and the build script silently skips Discord notifications so local runs stay quiet.

## Admin Authentication & Access Control

The admin dashboard at `/admin.html` now requires GitHub OAuth plus an allow list:

1. **Create a GitHub OAuth app** pointing to `https://your-domain.example/api/auth/callback`. Copy the `Client ID` and `Client Secret`.
2. **Set the required environment variables** in Vercel (or `.env` when running locally):
   - `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
   - `SESSION_SECRET` — any long random string for cookie signing (the website uses a randomly generated string made by Bitwarden)
   - `SITE_BASE_URL` — e.g. `https://coolmanyt.com`
   - `GITHUB_OWNER` / `GITHUB_REPO` (defaults already match this repo)
   - `ALLOWLIST_BRANCH` if your default branch isn’t `main`
   - `DISCORD_WEBHOOK_URL` (optional) — lets blog builds broadcast to Discord and powers the admin “Send test ping” button, plus send whatever they want to Discord, *including* `@everyone`s.
   - `YOUTUBE_API_KEY` (optional) — speeds up the homepage “Latest Upload” card by calling the YouTube Data API (`search.list` + `videos.list`), with feed/piped fallbacks when absent
3. **Seed the allow list** inside `content/admin-allowlist.json`. Only usernames in this file can finish the OAuth flow.
4. *(Optional but recommended)* **Enable in-dashboard allow list edits** by setting `ALLOWLIST_GITHUB_TOKEN` to a GitHub Personal Access Token with `repo` scope. Pair it with `ALLOWLIST_COMMIT_NAME` / `ALLOWLIST_COMMIT_EMAIL` if you want custom commit metadata. The admin panel uses these values to update `content/admin-allowlist.json`, so you can add/remove users without touching the repo manually.

Once these env vars are in place, visiting `/admin.html` prompts for GitHub sign-in. Approved accounts can copy build commands, create blog front matter, manage webhooks and adjust the allow list from the UI. Everyone else sees the locked screen.

## Deploying

The site loves static hosts: Vercel, Netlify, Cloudflare Pages, GitHub Pages—pick your favourite. Deploy the repo root as-is. After shipping notable changes, bump the `ver` constant in `script.js`, so the footer badge (and CDN caches) reflect the new release.

## Versioning

`script.js` exports `ver` for the footer badge and telemetry. Increment it every time you cut a release-worthy change so you can trace which build is live.

## Contributing

Ideas, bug reports, nitpicks? Open an issue or PR. Please keep new features accessible, resist dropping frameworks into the stack, and make sure interactive pieces degrade gracefully without JavaScript. If you know me IRL, bribe me with a slushie, and I will probably merge even faster. XD :3

---

Thank you oh so much for visiting my website, firstly, but also actually checking out the code that allows the website to run in the first place! I have spent hours on this code and to all the coders out there, may your code be life changing!

*Content sprinkled together with GPT-5.1-Codex (Preview).* 

