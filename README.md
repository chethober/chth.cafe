# CHTH Cafe

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A full-stack, single-cafe management application built for **CHTH Cafe** and optimized for deployment on **Cloudflare Workers** with custom domain **`chth.cafe`**, **Cloudflare D1 (SQL Database)**, **Cloudflare KV (Key-Value Cache)**, **Hono Framework**, **React**, and **Tailwind CSS**.

---

## Features

- **Public Digital Menu** — Clean, customer-facing digital menu with item variants (sizes, milk choices, extras), category filters, instant stock badges, and customer checkout drawer
- **Admin Workspace** — Password-protected staff management portal with:
  - **Financials** — Cash flow, POS order sales, manual expense logging, and P&L analytics
  - **Tasks** — Operational task manager and daily checklists
  - **Menu Editor** — Menu item editor, category manager, price variant options, and 1-click stock toggles
  - **Staff** — Barista PIN clock-in/out keypad, active staff roster, shift logs, and wage calculations
  - **Settings** — Store customization, logo URL, brand color pickers with live theme preview, currency, tax rates, and operational hours
- **Daily Manager Panel** — POS terminal, order management, task tracking, and employee shift monitoring
- **Telegram Notifications** — Real-time alerts for sales, shifts, tasks, and daily financial reports
- **Stock Management** — Raw material inventory tracking with low-stock alerts
- **Recipe Management** — Link menu items to stock ingredients with quantity requirements
- **Export & Backup** — Styled Excel reports, CSV export, JSON backup, and clipboard support
- **Dark/Light Mode** — Full theme support with persistent preference

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, TypeScript, Tailwind CSS 4, Vite |
| Backend | Hono (Cloudflare Workers) |
| Database | Cloudflare D1 (SQLite) |
| Cache | Cloudflare KV |
| Icons | Lucide React |
| Fonts | Plus Jakarta Sans, Outfit, JetBrains Mono |

---

## Quick Start

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- A [Cloudflare](https://www.cloudflare.com/) account (for D1 and KV)

### Installation

```bash
# Clone the repository
git clone https://github.com/chethober/chth.cafe.git
cd chth.cafe

# Install dependencies
npm install

# Start the dev server
npm run dev
```

### Database Setup

```bash
# Seed local D1 database
npm run db:seed

# Run migrations locally
npm run db:migrate:local
```

### Building for Production

```bash
# Build the project
npm run build

# Deploy to Cloudflare Workers
npm run deploy
```

---

## Configuration

### Environment Variables

| Variable | Description | Default |
|---|---|---|
| `VITE_ADMIN_PASSWORD` | Admin panel password | `chth2026` |
| `TELEGRAM_BOT_TOKEN` | Telegram bot token (server binding) | — |
| `TELEGRAM_CHAT_ID` | Telegram chat ID (server binding) | — |

### Cloudflare Wrangler Configuration

Update `wrangler.jsonc` with your Cloudflare resource IDs:

```jsonc
{
  "d1_databases": [
    {
      "binding": "DB",
      "database_name": "chth-cafe-db",
      "database_id": "<YOUR_D1_DATABASE_ID>"
    }
  ],
  "kv_namespaces": [
    {
      "binding": "KV",
      "id": "<YOUR_KV_NAMESPACE_ID>"
    }
  ],
  "routes": [
    { "pattern": "chth.cafe", "custom_domain": true },
    { "pattern": "www.chth.cafe", "custom_domain": true },
    { "pattern": "admin.chth.cafe", "custom_domain": true },
    { "pattern": "panel.chth.cafe", "custom_domain": true }
  ]
}
```

---

## Project Structure

```
├── src/
│   ├── components/    # React UI components
│   ├── db/           # Database schema, store, and seed data
│   ├── services/     # External service integrations (Telegram)
│   ├── utils/        # Utility functions
│   ├── App.tsx       # Main application component
│   ├── main.tsx      # Entry point
│   └── server.ts     # Hono API server (Cloudflare Worker)
├── scripts/          # Build and utility scripts
├── public/           # Static assets
└── wrangler.jsonc    # Cloudflare Workers configuration
```

---

## Deployment

### Cloudflare Workers

1. Create a D1 database and KV namespace in your Cloudflare dashboard
2. Update `wrangler.jsonc` with your resource IDs
3. Run `npm run deploy`

### Custom Domain

The app supports subdomain-based routing:
- `chth.cafe` — Public customer menu
- `admin.chth.cafe` — Admin workspace
- `panel.chth.cafe` — Daily manager panel

---

## Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

## Code of Conduct

This project adheres to the [Contributor Covenant](CODE_OF_CONDUCT.md). By participating, you are expected to uphold this code.

## Security

Please report security vulnerabilities by opening a [private security advisory](https://github.com/chethober/chth.cafe/security/advisories/new). See [SECURITY.md](SECURITY.md) for more details.

---

## License

Distributed under the [MIT License](LICENSE).
