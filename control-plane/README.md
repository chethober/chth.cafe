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

Wrangler creates the `chth-cafe-control-plane` database on the first deploy, and the Worker creates its tables on first use. It serves `chth.cafe`, `www.chth.cafe` and the platform admin on `admin.chth.cafe`; change the `routes` in `control-plane/wrangler.jsonc` to serve it on your own domain.

### Platform admin

`admin.<host>` is for whoever runs the control plane. It lists every connected account and café, and can rename a café, update it to the latest release with the owner's saved access, remove it from the platform (it keeps running), delete it from Cloudflare, or remove an account (its access is revoked and it is signed out everywhere; its cafés keep running).

It also sets the **notice line**: one line of text, with an optional https link, shown at the top of every café's admin and panel, for announcements or adverts. Each café can show the platform's line, its own, or none. Cafés ask `GET /api/notice?cafe=<id>` on the main host and keep the answer for ten minutes; cafés deployed before the notice line existed show it after their next update.

`npm run deploy:control-plane` sets a new admin password on every deploy and prints it once. Only its SHA-256 reaches Cloudflare (the `ADMIN_PASSWORD_HASH` secret), and a new password ends every admin session. The release workflow's deploy keeps the previous password, and never prints one in public logs.

Keep `ENCRYPTION_KEY` safe: it decrypts every owner's Cloudflare access. Losing it only means owners have to connect again; their cafés keep running.

### Releases

`.github/workflows/release.yml` runs on every push to `master`. It packages the café, runs the tests, publishes a GitHub release `cafe-v<version>` with the bundle attached, and deploys the control plane when `CLOUDFLARE_API_TOKEN` and `CLOUDFLARE_ACCOUNT_ID` are set. Owners then see **Update to <version>** on their dashboard.

## Connecting an account

**API token** (always available). The dashboard links to Cloudflare's token page with the permissions filled in: Workers Scripts, Workers KV Storage and D1 set to Edit, and Account Settings set to Read. The custom-domain link adds Zone: Read and Workers Routes: Edit. The control plane checks the token reaches all three products before saving it.

**Connect with Cloudflare** (OAuth). Shown once you register an OAuth client ([Cloudflare's guide](https://developers.cloudflare.com/fundamentals/oauth/create-an-oauth-client/)):

1. In the Cloudflare dashboard, go to Manage Account → OAuth clients and create a client.
2. Response type `code`, grant type `authorization_code`, and token authentication method `client_secret_post` (or `none` for a public PKCE client without a secret; `client_secret_basic` is not supported).
3. Set the client URL to `https://<control plane host>` and the redirect URL to `https://<control plane host>/connect/oauth/callback`.
4. Choose the scopes: Workers: Edit, Workers KV Storage: Edit, D1: Edit and Account Settings: Read, and, optional for custom domains, Zone: Read and Workers Routes: Edit. These are `DEFAULT_SCOPES` in `src/oauth.ts`; set `CF_OAUTH_SCOPES` to request others.
5. To let owners outside your account sign in, verify the client URL's domain with the `cloudflare_oauth_client_publisher=` TXT record Cloudflare gives you, then change the client's visibility to public. That change is permanent.
6. Set the secrets:

   ```bash
   npx wrangler secret put CF_OAUTH_CLIENT_ID -c control-plane/wrangler.jsonc
   npx wrangler secret put CF_OAUTH_CLIENT_SECRET -c control-plane/wrangler.jsonc   # not for token authentication method none
   ```

The flow uses PKCE and a single-use state bound to the browser that started it. Access tokens are refreshed shortly before they expire, and revoked when the owner disconnects.

## Security notes

- Cloudflare credentials are encrypted with AES-GCM, with the account ID bound in, so a row copied to another account does not decrypt.
- Sessions are random tokens stored as SHA-256 hashes. Every form carries a CSRF token tied to the session and must come from the control plane's own origin.
- Signing in with Cloudflare uses a single-use state kept both in the database and in a cookie in the browser that started it. Token sign-ins are rate limited per address. Every deploy, update, setup link, disconnect and delete is written to `audit_log`.
- The admin password is about 100 random bits, checked against its SHA-256, rate limited per address, and only valid until the next deploy. Admin forms carry their own CSRF token, and admin actions are written to the owner's `audit_log` as `admin:<action>`.
- Owners can revoke the control plane at any time: from their Cloudflare profile for OAuth, or by deleting the API token.

## Tests

`npm test` runs `tests/control-plane.test.mjs` against a fake Cloudflare API, OAuth server and café, and `tests/release.test.mjs`, which boots the packaged Worker and completes setup.
