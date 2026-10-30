# CHTH Café Cloud (control plane)

A small Worker where café owners sign in with their own Cloudflare account and deploy the café in one click. Each café runs in the **owner's** account, with its own Worker, D1 database and KV namespace.

There are no control plane accounts, emails or passwords. Owners sign in with Cloudflare (OAuth) or an API token, and the Cloudflare account they reach *is* the owner: anyone who can reach that account manages its cafés. The control plane keeps only the account's name, an encrypted way to reach it, and the list of cafés it deployed. Disconnecting forgets that access and signs the account out everywhere.

```
owner ──▶ control plane ──(owner's token or OAuth)──▶ Cloudflare API ──▶ café Worker + D1 + KV in the owner's account
```

## What a deploy does

1. Creates the D1 database `<worker>-db` and KV namespace `<worker>-kv`, or reuses them if they exist.
2. Optionally loads the demo menu (`schema.sql`).
3. Uploads only the static assets Cloudflare does not already hold, then the Worker, with the `DB`, `KV` and `ASSETS` bindings, `CAFE_WORKSPACE_PATHS` and a one-time `SETUP_TOKEN` secret.
4. Sets the hourly cron, enables workers.dev, and attaches `example.com`, `admin.example.com` and `panel.example.com` when the owner gives a custom domain.
5. Shows a setup link (`…/admin#setup=<code>`). The owner chooses the admin and panel passwords there; the control plane never sees them and keeps no copy of the code.

**Update to <version>** re-runs steps 3 and 4 with the newest release. Existing secrets are kept, and the café upgrades its own database on first use. **Remove** either forgets the café here (it keeps running) or deletes the Worker, database and namespace once the owner types the Worker name.

## Running it

The control plane deploys the café release packaged next to it (`release/`, from `npm run release`). It runs on the free plan, but encoding a café's files can pass the free plan's 10 ms CPU limit; on Workers Paid, uncomment the `limits` block in `wrangler.jsonc`.

```bash
npx wrangler login
openssl rand -base64 32 | npx wrangler secret put ENCRYPTION_KEY -c control-plane/wrangler.jsonc
npm run deploy:control-plane
```

Wrangler creates the `chth-cafe-control-plane` database on the first deploy, and the Worker creates its tables on first use. It serves `chth.cafe` and `www.chth.cafe`; change the `routes` in `control-plane/wrangler.jsonc` to serve it on your own domain.

Keep `ENCRYPTION_KEY` safe: it decrypts every owner's Cloudflare access. Losing it only means owners have to connect again; their cafés keep running.

### Releases

`.github/workflows/release.yml` runs on every push to `master`. It packages the café, runs the tests, publishes a GitHub release `cafe-v<version>` with the bundle attached, and deploys the control plane when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set. Owners then see **Update to <version>** on their dashboard.

## Connecting an account

**API token** (always available). The dashboard links to Cloudflare's token page with the permissions filled in: Workers Scripts, Workers KV Storage and D1 set to Edit, and Account Settings set to Read. The custom-domain link adds Zone: Read and Workers Routes: Edit. The control plane checks the token reaches all three products before saving it.

**Connect with Cloudflare** (OAuth). Shown once you register an OAuth client:

1. In the Cloudflare dashboard, go to Manage Account → OAuth apps and create a client.
2. Set the redirect URI to `https://<control plane host>/connect/oauth/callback`.
3. Allow the authorization code and refresh token grants, and the scopes in `src/oauth.ts` (`DEFAULT_SCOPES`), or set your own in `CF_OAUTH_SCOPES`.
4. Verify your publisher domain, then promote the client to public so owners outside your account can use it.
5. Set the secrets:

   ```bash
   npx wrangler secret put CF_OAUTH_CLIENT_ID -c control-plane/wrangler.jsonc
   npx wrangler secret put CF_OAUTH_CLIENT_SECRET -c control-plane/wrangler.jsonc   # confidential clients only
   ```

The flow uses PKCE and a single-use state bound to the browser that started it. Access tokens are refreshed shortly before they expire, and revoked when the owner disconnects.

## Security notes

- Cloudflare credentials are encrypted with AES-GCM, with the account ID bound in, so a row copied to another account does not decrypt.
- Sessions are random tokens stored as SHA-256 hashes. Every form carries a CSRF token tied to the session and must come from the control plane's own origin.
- Signing in with Cloudflare uses a single-use state kept both in the database and in a cookie in the browser that started it. Token sign-ins are rate limited per address. Every deploy, update, setup link, disconnect and delete is written to `audit_log`.
- Owners can revoke the control plane at any time: from their Cloudflare profile for OAuth, or by deleting the API token.

## Tests

`npm test` runs `tests/control-plane.test.mjs` against a fake Cloudflare API, OAuth server and café, and `tests/release.test.mjs`, which boots the packaged Worker and completes setup.
