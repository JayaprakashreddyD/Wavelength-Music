# Wavelength deployment preparation

This guide prepares a Vercel web app, Render API, Neon PostgreSQL, Upstash Redis, and Cloudflare R2 deployment. It documents manual setup; it does not deploy services or run remote migrations. Replace every angle-bracket value with your own provider value. Never commit real credentials.

## Before you start

- Use Node.js 24.20.0 (`.node-version`) and npm. Node 20 reached end of life in March 2026; the optional Dockerfiles use Node 24 as well.
- This is an npm-workspaces monorepo. Run install/build commands from the repository root unless a command says otherwise.
- For production, use a frontend and API on subdomains of the same custom domain when possible, such as `app.example.com` and `api.example.com`. The default `vercel.app` and `onrender.com` origins are cross-site; browser third-party-cookie blocking can break refresh/login persistence even with `SameSite=None; Secure`.
- The API requires PostgreSQL, Redis, public S3-compatible media storage, SMTP, and Google OAuth configuration in production. Its `/api/health` route is a liveness check, not a database/storage readiness check.

## 1. Create provider resources

### Neon PostgreSQL

Create a production database and copy both connection strings. Set `DATABASE_URL` to the pooled connection string for the long-running API and `DIRECT_URL` to the direct connection string for Prisma CLI migrations. Keep SSL enabled (`sslmode=require`). The schema uses `DATABASE_URL` at runtime and `DIRECT_URL` for Prisma CLI operations.

### Upstash Redis

Create Redis with TLS. Copy its **TCP** connection URL (`rediss://...`) to `REDIS_URL`. The server uses `ioredis` for rate limiting, room state, and the Socket.IO Redis adapter; the Upstash REST URL/token pair is not compatible with this setting.

### Cloudflare R2

Create a bucket and an R2 API token scoped to that bucket with Object Read and Object Write. Configure:

```text
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
S3_BUCKET=<BUCKET_NAME>
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_URL=https://<MEDIA_CUSTOM_DOMAIN>
```

Attach a custom domain to the bucket for production media URLs. The application returns public audio/artwork/avatar URLs; uploaded media is public to anyone with its URL. Do not use R2's `r2.dev` URL as a production media host. Current uploads are made by the server, so browser PUT CORS rules are not needed unless the upload implementation changes to direct browser-to-R2 requests.

### Google OAuth and Gmail SMTP

Create a Google OAuth **Web application** client. Add the exact frontend HTTPS origin (for example, `https://app.example.com`) under Authorized JavaScript origins. This app sends a Google Identity Services credential to the API; it does not use an OAuth redirect callback, so no redirect URI is required by this flow. Set the same client ID as `GOOGLE_CLIENT_ID` on Render and `NEXT_PUBLIC_GOOGLE_CLIENT_ID` on Vercel.

For email codes, password reset, and email-change verification, configure `EMAIL_USER` and `EMAIL_APP_PASSWORD` with a Gmail address and Google App Password (or change the mail transport before using another SMTP provider). Set `WEB_APP_URL` to the exact frontend origin.

## 2. Configure Render API

Create a **Node Web Service** from the repository. Leave Root Directory at the repository root (the directory containing root `package.json` and `package-lock.json`). Do not select Docker for this guide.

```text
Build command: npm ci && npm run prisma:generate --workspace=packages/server && npm run build:server
Start command: npm run start --workspace=packages/server
Health check path: /api/health
```

Use Node `24.20.0` (`NODE_VERSION=24.20.0`, or the repository `.node-version` if detected). Configure these Render environment variables in its dashboard; do not place production values in files or source control:

```text
NODE_ENV=production
CORS_ORIGIN=https://<FRONTEND_CUSTOM_DOMAIN>
TRUST_PROXY=1
COOKIE_PATH=/
COOKIE_SAME_SITE=lax
COOKIE_SECURE=true
WEB_APP_URL=https://<FRONTEND_CUSTOM_DOMAIN>
DATABASE_URL=<NEON_POOLED_URL>
DIRECT_URL=<NEON_DIRECT_URL>
REDIS_URL=<UPSTASH_TCP_REDS_URL>
JWT_ACCESS_SECRET=<UNIQUE_RANDOM_SECRET_AT_LEAST_32_CHARS>
JWT_REFRESH_SECRET=<DIFFERENT_UNIQUE_RANDOM_SECRET_AT_LEAST_32_CHARS>
GOOGLE_CLIENT_ID=<GOOGLE_WEB_CLIENT_ID>
EMAIL_USER=<SMTP_GMAIL_ADDRESS>
EMAIL_APP_PASSWORD=<GMAIL_APP_PASSWORD>
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_REGION=auto
S3_ACCESS_KEY_ID=<R2_ACCESS_KEY_ID>
S3_SECRET_ACCESS_KEY=<R2_SECRET_ACCESS_KEY>
S3_BUCKET=<BUCKET_NAME>
S3_FORCE_PATH_STYLE=false
S3_PUBLIC_URL=https://<MEDIA_CUSTOM_DOMAIN>
```

Render supplies `PORT`; do not hardcode it. Add any additional exact frontend origins to `CORS_ORIGIN` as a comma-separated list. Do not use `*`. Keep `COOKIE_DOMAIN` unset so cookies remain host-only. With `app.example.com` and `api.example.com`, they are same-site; the browser request still needs credentials, which the existing client and API CORS configuration support. If you must use cross-site provider domains, `SameSite=None` and Secure cookies are required, but third-party cookie restrictions can still prevent reliable sessions.

### Manual release migration (not run here)

Review the pending migration list and database backup/recovery plan first. After the database and API environment are configured, run this command once as a deliberate release step from the repository root, using the Render production environment:

```bash
npx prisma migrate deploy --schema=packages/server/prisma/schema.prisma
```

Do not run `npm run prisma:migrate` in production; it invokes the development migration workflow. Do not configure automatic migration execution unless you have separately designed and tested a release process.

## 3. Configure Vercel web app

Import the same repository as a Vercel project and set **Root Directory** to `packages/web`. Use the Next.js framework preset, Node `24.x`, and the package's `npm run build` script. Keep the root lockfile/workspace installation available when Vercel configures dependency installation.

Add these environment variables for each target environment. They are public values embedded at build time, so rebuild after changing them:

```text
NEXT_PUBLIC_API_URL=https://<API_CUSTOM_DOMAIN>/api
NEXT_PUBLIC_SOCKET_URL=https://<API_CUSTOM_DOMAIN>
NEXT_PUBLIC_GOOGLE_CLIENT_ID=<SAME_GOOGLE_WEB_CLIENT_ID>
```

`NEXT_PUBLIC_*` values must never contain credentials. Add the frontend origin to Render's `CORS_ORIGIN` and Google's Authorized JavaScript origins. API and socket URLs must use HTTPS in production.

## 4. Validate configuration before launch

From the repository root:

```bash
npm ci
npm run prisma:generate
npm run build:server
npm run build:web
npm run lint
npm test
```

The web production build validates the public URLs. For local builds, set `NEXT_PUBLIC_API_URL` and `NEXT_PUBLIC_SOCKET_URL` to HTTPS URLs and provide `NEXT_PUBLIC_GOOGLE_CLIENT_ID`; no real production secret is needed to compile the web app. From `packages/server`, validate the Prisma schema and inspect migration status against the intended database only when you intentionally provide its connection variables:

```bash
npx prisma validate
npx prisma migrate status
```

`migrate status` is inspection; `migrate deploy` changes a database. Never point local verification at production unintentionally.

After manual setup, verify registration, duplicate-account errors, login/logout/refresh, Google sign-in, email codes, password reset, song upload/playback, media URLs, and room websocket behavior using the deployed URLs. Confirm cookies in the target browsers and review logs/alerts for API, PostgreSQL, Redis, email, and object storage.

## Operational limits to account for

- The song-end scheduler is in-memory and correct for a single API process. Do not scale API instances horizontally until it is replaced with a distributed scheduler; Socket.IO's Redis adapter alone does not distribute this timer.
- Song records are stored in PostgreSQL; audio/artwork/avatar objects are stored in R2. The current shared-library model serves uploaded media publicly. Privacy, copyright complaints, takedown handling, and upload abuse need an operational policy before opening uploads broadly.
- `/api/health` verifies API liveness only. It does not prove PostgreSQL, Redis, SMTP, or R2 readiness.

See [README.md](README.md) for local development and [docs/API.md](docs/API.md) for the API reference. Dockerfiles remain available for local image builds; this guide uses native Render and Vercel builds.
