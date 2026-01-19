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

### When is a GitHub Issue OK?
Please **do not** open a public GitHub issue for vulnerabilities that could be exploited (ex: auth bypass, XSS, injection, account/session issues, sensitive data exposure).

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

## Security Measures

This project implements several security measures to protect admin functionality and sensitive data:

### Authentication & Authorization
- **GitHub OAuth**: All admin endpoints require authenticated GitHub users
- **Allow list**: Only users listed in `content/admin-allowlist.json` can access admin features
- **Session management**: Signed, tamper-proof session cookies with expiration
- **Shared authentication guard**: Centralized `requireAllowlistedSession` helper prevents bypass vulnerabilities

### Data Protection
- **No credential leakage**: Webhook URLs and environment variable values are never exposed in API responses
- **Secure cookies**: Production deployments use `HttpOnly` and `Secure` flags; local development supports HTTP for testing
- **Signed sessions**: HMAC-SHA256 signatures prevent session tampering

### API Security
- **Method validation**: Endpoints validate HTTP methods and return appropriate status codes
- **Input sanitization**: User inputs are validated and sanitized before processing
- **Error handling**: Generic error messages prevent information disclosure

### Best Practices
- **Minimal privilege**: Admin operations require both authentication and allow list membership
- **Defense in depth**: Multiple layers of validation on sensitive operations
- **Fail secure**: Missing credentials or invalid sessions result in access denial
