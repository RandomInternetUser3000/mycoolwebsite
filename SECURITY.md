# Security Policy

## Supported Versions

This project is actively maintained only on the **current version**.

You can find the current website version in:
- `script.js` line 1 (the `ver` constant)
- The website footer (if displayed)
- Commit notes

| Version | Supported |
|--------|-----------|
| Current | Yes |
| Older releases | No |

## Scope
**Canonical production domain:** https://coolmanyt.com

### In scope
- The production website hosted on **Vercel** (served from this repository)
- The source code in this repository (`COOLmanYT/mycoolwebsite`)
- Site endpoints implemented by this repo (for example, any `/api/*` routes included here)

### Out of scope
- Vulnerabilities in **Vercel’s platform/infrastructure** itself
- Issues in third-party services not maintained by this project
- Social engineering, physical attacks, or denial-of-service (DoS/DDoS)

## Reporting a Vulnerability

If you believe you’ve found a security vulnerability, please report it **privately**.

### Preferred: Email
Send details to: **official.coolman.yt[@]gmail.com**

Please include:
- A clear description of the issue and potential impact
- Steps to reproduce (or a proof-of-concept)
- Affected page(s) / endpoint(s) / file(s)
- Any logs, screenshots, or relevant links

### Alternative contact
You may also contact me via: https://coolmanyt.com/contact.html

You can also report using: https://github.com/COOLmanYT/mycoolwebsite/security/advisories/new

### When is a GitHub Issue OK?
Please **do not** open a public GitHub issue for vulnerabilities that could be exploited (e.g: auth bypass, XSS, injection, account/session issues, sensitive data exposure).

A GitHub issue is OK for:
- Non-sensitive security hardening suggestions
- Dependency update suggestions (when no exploit details are shared)
- General “security best practices” recommendations

## Coordinated Disclosure / What to Expect

After you report a vulnerability, you can expect updates when:
- The report has been reviewed and confirmed, or declined
- A fix is in progress
- A fix has been released

I’ll respond using the same contact method you used (unless you request otherwise).

## Safe Harbour

If you act in good faith and avoid privacy violations, service disruption, and data destruction, I will not pursue action against you for responsible disclosure. Usage of the website and searching for vulnerabilities must follow the website Terms of Service, available right in the repo or at https://coolmanyt.com/terms.html.
