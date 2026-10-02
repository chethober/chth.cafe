# Security Policy

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security seriously. If you discover a security vulnerability, please report it responsibly.

**Do NOT open a public issue for security vulnerabilities.**

Instead, please report vulnerabilities by:

1. Opening a [private security advisory](https://github.com/chethober/chth.cafe/security/advisories/new) on GitHub
2. Or emailing the maintainers directly

Please include:

- A description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes (if available)

We will acknowledge your report within 48 hours and work with you to understand and address the issue before any public disclosure.

## Security Best Practices for Deployments

When deploying CHTH Cafe:

- **Use strong server passwords** — Local startup generates fresh passwords; configure distinct `ADMIN_PASSWORD` and `PANEL_PASSWORD` Worker secrets for deployment
- **Use strong staff PINs** — Avoid simple PINs like `12345`
- **Keep secrets secret** — Never commit `.env` files or real credentials to the repository
- **Use HTTPS** — Always deploy with TLS enabled
- **Regularly update dependencies** — Run `npm audit` and keep packages up to date
