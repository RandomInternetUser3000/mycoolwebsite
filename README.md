# My Personal Website

This repo powers COOLmanYT's public site: a static, no-build playground for project write-ups, devlogs, embeds, and ways to get in touch. Everything ships as plain HTML, modern CSS, and one JavaScript file so deploys stay instant and debugging stays human.

## Highlights
- Accessible navigation with skip links, scrollable pill menus, strong focus outlines, and reduced-motion safeguards.
- Release countdown and "My Favourite Songs" cards that now share the same glassy gradients in dark and light themes.
- Dynamic "Latest Upload" panel that fetches the newest YouTube video via channel handle/ID fallbacks, thumbnails, stats, and durations.
- Lazy-loaded heavy modules in `script.js`, so project/blog viewers, share buttons, and analytics logic only run when the relevant DOM exists.
- Formspree-powered contact form with inline status messaging plus an automatic fallback when CORS blocks AJAX submissions.
- Structured metadata (Open Graph, Twitter, JSON-LD) across every page to keep previews and SEO tidy.

## Repository Layout

```
mycoolwebsite/
├── index.html                   # Homepage + hero, latest video, countdown, playlist
├── about.html                   # Meet-the-creator page (paired with about.css)
├── projects.html                # Project gallery + inline viewer templates
├── blog.html                    # Blog listing + inline reader templates
├── contact.html                 # Contact channels + Formspree form
├── gallery.html                 # Screenshot grid + light narrative
├── style.css                    # Global styles + component systems
├── script.js                    # Theme toggle, countdown, lazy initializers, forms
├── about.css                    # Extra styles for /about
├── contact.css                  # Extra styles for /contact
├── blog/                        # Standalone blog entries
│   └── social-media-ban.html    # Protest essay with refreshed relative paths
├── projects/                    # Project deep dives (direct links)
│   ├── project-aurora-arena.html
│   ├── project-personal-website.html
│   └── project-shortform-toolkit.html
├── images/                      # Icons, avatars, placeholders
└── README.md                    # You are here :)
```

> Legacy root-level `project-*.html` and `social-media-ban.html` files were relocated into `projects/` and `blog/`. Update bookmarks if you had them saved.

## Local Development

1. Clone the repo and open it in VS Code (or your editor of choice).
2. Serve the files with any static server so relative paths work:
   - VS Code Live Server
   - `npx serve`
   - `python -m http.server`
3. Visit `http://localhost:PORT/index.html`, edit, refresh. No build pipeline required.

> Tip: When testing the contact form locally, Formspree may require a CAPTCHA redirect. The script flashes a "Redirecting to Formspree..." message and then posts the fallback form automatically.

## Updating Content

- Latest YouTube upload — update the `data-channel-user` (or optional `data-channel-id`) on the `[data-latest-video]` block in `index.html`. The script resolves handles, IDs, or legacy usernames automatically.
- Blog posts — add cards + templates inside `blog.html` for inline reading, and place dedicated permalink pages inside `blog/` with `../` asset paths (see `blog/social-media-ban.html`).
- Projects — extend `projects.html` with new cards + `<template>` blocks, and drop long-form write-ups into `projects/your-page.html` so you can share direct URLs.
- Social buttons — edit the `.social-links` clusters on each page (plus the hero footer). Icons live under `images/`; remember alt text.
- Images — drop optimized assets into `images/` and reference them relatively (`images/avatar.png`).

## Deploying

The site loves static hosts: Vercel, Netlify, Cloudflare Pages, GitHub Pages—pick your favorite. Deploy the repo root as-is. After shipping notable changes, bump the `ver` constant in `script.js` so the footer badge (and CDN caches) reflect the new release.

## Versioning

`script.js` exports `ver` for the footer badge and telemetry. Increment it every time you cut a release-worthy change so you can trace which build is live.

## Contributing

Ideas, bug reports, nitpicks? Open an issue or PR. Please keep new features accessible, resist dropping frameworks into the stack, and make sure interactive pieces degrade gracefully without JavaScript. If you know me IRL, bribe me with a slushie and I will probably merge even faster. XD

---

Thanks for reading and/or snooping. May your gradients always line up and your countdown timers always end with "RELEASEEEEEEEEEEEEEEEE!!!"

*Content sprinkled together with GPT-5.1-Codex (Preview).* 
