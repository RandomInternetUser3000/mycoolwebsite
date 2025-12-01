# My Personal Website

This repository powers the public site for COOLmanYT — a hub for project write-ups, devlogs, the latest video content, and ways to get in touch. The site is intentionally as lightweight as possible: plain HTML, modern CSS, and a single JavaScript file handle all the interactions so the pages stay fast on every device. It only took 69 commits (noice) to get to an almost completed website.

## ✨ Highlights
- **Accessible navigation** with a scrollable pill menu, skip links, keyboard focus states, and reduced-motion safeguards.
- **Dynamic “Latest Upload” card** that resolves the YouTube channel feed through resilient fallbacks and shows thumbnail, stats, and duration.
- **Inline readers** for blog posts and project case studies so visitors can dive into long-form content without leaving the index pages.
- **Formspree-powered contact form** with progressive enhancement: inline status messaging when CORS allows, instant fallback to the Formspree CAPTCHA when needed.
- **Spotify playlist embed** on the homepage for the people who want to see what my music taste is like (toby fox and minecraft is goated and no one can change my opinion other than breakcore).
- **Unified social buttons** across every page (GitHub, YouTube, Discord, Roblox, Spotify, Reddit, and Steam) with consistent tooltips and accessible labels.
- **Structured metadata** (Open Graph, Twitter, JSON-LD) across every page to keep previews and SEO tidy.

## 🗂️ Repository Layout

```
mycoolwebsite/
├── index.html                     # Homepage with hero, latest upload, playlist embed
├── about.html                     # Meet-the-creator page (paired with about.css)
├── projects.html                  # Project gallery + inline modal viewer
├── blog.html                      # Blog listing + reader modal + templates
├── contact.html                   # Contact methods and Formspree form
├── gallery.html                   # Screenshot grid + light narrative
├── social-media-ban.html          # Latest standalone article (direct linkable)
├── project-aurora-arena.html      # Deep-dive page for Aurora Arena
├── project-personal-website.html  # Deep-dive page for the site rebuild
├── project-shortform-toolkit.html # Deep-dive page for the Shorts toolkit
├── style.css                      # Global styling, utilities, responsive tweaks
├── script.js                      # Theme toggle, modals, latest video fetch, contact form logic
├── about.css, contact.css         # Page-specific styling supplements
├── images/                        # Site imagery and icons (GitHub, Steam, etc.)
└── README.md                      # You're here, good job!
```

## 🛠️ Local Development

1. **Clone** the repo and open it in VS Code (or your editor of choice).
2. **Serve the files** with any static server so relative paths work:
	- VS Code Live Server
	- `npx serve` (Node)
	- `python -m http.server` (Python)
3. Visit `http://localhost:PORT/index.html` and iterate. Because everything is static, no build step is required.

> Tip: When testing the contact form locally, Formspree may require a CAPTCHA redirect. The script will auto-fallback to the native submission after showing a “Redirecting to Formspree…” message.
> Another Tip: This was generated with AI so do what you will with that information.

## ✍️ Updating Content

- **Latest YouTube upload** — update the `data-channel-user` (or optionally `data-channel-id`) attributes on the `data-latest-video` section in `index.html`. The script resolves handles, channel IDs, and legacy usernames automatically.
- **Blog posts** — add a new `<article class="blog-card">` in `blog.html` and a matching `<template id="blog-template-your-slug">` with the full article content.
- **Projects** — extend the grid in `projects.html` and create a corresponding `<template id="project-template-your-slug">` so the inline viewer can render it. Standalone HTML pages can live alongside for direct links.
- **Social buttons** — add or edit anchors inside the `.social-links` blocks in each page header (and the hero footer on `index.html`). Icons live in `images/`, so dropping in a file like `images/steam.png` is all you need before referencing it.
- **Images** — drop assets into `images/` and reference them relatively (e.g., `images/avatar.png`). Remember to include alt text.

## 🚀 Deploying

The site is optimized for static hosting providers like Vercel, Netlify, or GitHub Pages. Deploy the repository root as-is; no build command is necessary. Remember to invalidate caches (or bump the version string in `script.js`) after shipping sizable changes so visitors load fresh assets.

## 🔖 Versioning

The global constant `ver` in `script.js` controls the version badge rendered in the footer. Increment it whenever you cut a new release so visitors — and you — can spot the deployed revision at a glance.

## 🤝 Contributing

Open to suggestions and tweaks! Feel free to fork, open an issue, or submit a pull request. If you add a new interactive feature, keep accessibility top-of-mind and stay within the plain HTML/CSS/JS stack so the deploys remain frictionless. And if you know me in real life, feel free to find and fund me. XD

---

Thanks for visiting, reading, or hacking on the site. Hope you enjoyed, and to my fellow coders, I hope your code runs as smooth as butter AND you understand how your code works so you can improve it without exploding your brains out.

*Content generated by GPT 5 (mostly)*.
