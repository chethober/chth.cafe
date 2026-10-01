# Contributing to CHTH Cafe

Thank you for your interest in contributing to CHTH Cafe! We welcome contributions from the community.

## Getting Started

1. Fork the repository
2. Clone your fork: `git clone https://github.com/chethober/chth.cafe.git`
3. Install dependencies: `npm install`
4. Create a new branch: `git checkout -b feature/your-feature-name`

## Development

### Prerequisites

- Node.js 18+
- npm or yarn
- A Cloudflare account (for D1 and KV bindings)

### Local Development

```bash
# Start the dev server
npm run dev

# Run type checking
npm run check

# Build for production
npm run build
```

### Database Setup

```bash
# Seed local D1 database
npm run db:seed

# Run migrations locally
npm run db:migrate:local
```

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

## Code Style

- TypeScript strict mode
- Tailwind CSS for styling
- Functional components with hooks
- Follow the existing code patterns

## Pull Requests

1. Ensure your code passes type checking (`npm run check`)
2. Write clear commit messages
3. Update documentation if needed
4. Keep PRs focused on a single feature or fix
5. Describe the motivation for the change in the PR description

## Reporting Issues

Please use the [issue tracker](https://github.com/chethober/chth.cafe/issues) to report bugs or request features. Include:

- A clear description of the issue
- Steps to reproduce
- Expected vs actual behavior
- Your environment (Node version, OS, browser)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
