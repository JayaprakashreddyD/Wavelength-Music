# Wavelength — synchronized music rooms

A Spotify-inspired music platform whose main feature is real-time, server-authoritative
synchronized listening rooms. Full-stack TypeScript monorepo: Next.js frontend,
Node/Express/Socket.IO backend, PostgreSQL via Prisma, Redis, S3-compatible object storage.

```
music-room/
  packages/
    server/   Express REST API + Socket.IO real-time layer + Prisma schema
    web/      Next.js 14 (App Router) frontend
  docker-compose.yml   Postgres + Redis + MinIO (local S3) for development
```

## 1. Quick start (local development)

**Prerequisites:** Node.js 24.20.0 (see `.node-version`), Docker (for Postgres/Redis/MinIO), npm.

```bash
# 1. Start infrastructure
docker compose up -d

# 2. Create the MinIO bucket used for audio/artwork/avatars
#    (MinIO console is at http://localhost:9001 — user/pass: musicroom / musicroom123
#     — or use the CLI):
docker run --rm --network host minio/mc \
  alias set local http://localhost:9000 musicroom musicroom123 && \
  docker run --rm --network host minio/mc mb local/music-room --ignore-existing

# 3. Install dependencies (from repo root — npm workspaces)
npm install

# 4. Configure environment
cp packages/server/.env.example packages/server/.env
cp packages/web/.env.local.example packages/web/.env.local
# Edit packages/server/.env: set JWT_ACCESS_SECRET / JWT_REFRESH_SECRET and GOOGLE_CLIENT_ID.
# Set EMAIL_USER and EMAIL_APP_PASSWORD to enable Gmail OTP delivery.
# Set NEXT_PUBLIC_GOOGLE_CLIENT_ID in packages/web/.env.local to the same Google OAuth web client ID.
# In Google Cloud Console, allow http://localhost:3000 as an authorized JavaScript origin.

# 5. Set up the database
npm run prisma:generate
npm run prisma:migrate   # creates tables, prompts for a migration name

# 6. Run both apps (two terminals)
npm run dev:server   # http://localhost:4000
npm run dev:web      # http://localhost:3000
```

Open two browser windows (or one normal + one incognito) at `http://localhost:3000`,
register two different accounts, create a room in one, join it from the other via the
public rooms list or a room code, and press play — both should stay in sync.

## 2. Architecture notes

### Server-authoritative playback

The single most important requirement in the spec: playback state lives on the server
(`RoomPlaybackState` table), not on any client. A snapshot is `{ currentSongId, state,
position, serverTimestamp, queueVersion }`. Every client computes its target playhead as:

```
target = position + (state === "PLAYING" ? (now - serverTimestamp) / 1000 : 0)
```

recomputed fresh from the latest snapshot on every tick — see
`packages/server/src/services/playbackService.ts` (server side) and
`packages/web/lib/roomSync.ts` (client side, including drift correction: small drift is
corrected by nudging `audio.playbackRate`, large drift triggers a hard seek).

The server also owns song-end auto-advance via `setTimeout`, so clients never race each
other to decide "what's next" — see the comment in `playbackService.ts` about
`songEndTimers`. **This scheduler is in-memory and single-process.** It's correct and
sufficient for one server instance. If you scale the backend horizontally, replace it
with a distributed scheduler (e.g. a Redis sorted set of due times polled by every
instance and claimed with a lock, or BullMQ delayed jobs) so exactly one instance fires
each transition — the Socket.IO layer already uses the Redis adapter so broadcasts fan
out correctly across instances regardless.

### Duplicate-proof room queue

Enforced at the database level via a `(roomId, songId)` unique constraint on
`RoomQueueSong` (see `prisma/schema.prisma`), not just filtered in application code —
concurrent adds from two clients can't create a duplicate. `queueService.ts` also
pre-filters so the "N added, M duplicates skipped" message is accurate.

### Roles & permissions

A single permission table (`packages/server/src/sockets/permissions.ts`) is the only
place that decides what HOST/ELDER/MEMBER can do. Every privileged Socket.IO event and
REST route re-derives the caller's role from the database on every request — the
frontend's UI gating (hiding buttons a MEMBER shouldn't see) is purely cosmetic and never
trusted.

### Host migration & reconnects

Disconnects get a 20s grace period (`DISCONNECT_GRACE_MS` in `roomSocket.ts`) before
being treated as final, so a refresh or flaky connection doesn't trigger host migration
or a "member left" broadcast. If the host disconnects permanently, the longest-tenured
connected Elder (or failing that, Member) is promoted deterministically; an empty room
is closed.

## 3. Known limitations / things to decide before production

- **Song-end scheduler is single-instance** (see above) — fine for one server process,
  needs a distributed version to scale horizontally.
- **Email delivery uses Gmail SMTP.** Password reset and email-change verification use
  one-time links. Configure `WEB_APP_URL`, `EMAIL_USER`, and `EMAIL_APP_PASSWORD` on the
  API host; use a transactional mail service with monitoring before a large public launch.
- **DRM / download rights** are out of scope by design, per the spec — the
  `isDownloadable` flag on `Song` is a simple on/off switch, not a rights-management
  system. Whoever uploads a song is trusted to have rights to it.
- **Recommendations are a simple heuristic** (most-played songs in genres you've
  recently listened to) — swap for a real recommendation system if needed.
- **Rate limits, file size limits, and JWT TTLs** are set to reasonable defaults in
  `.env.example` — tune for your traffic before launch.

## 4. Production deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for the audited Vercel + Render + Neon + Upstash + Cloudflare R2 setup, production environment variables, manual migration procedure, and operational limits. Deployment and production migrations are deliberate manual steps.

## 5. Acceptance criteria checklist (from spec §29)

All implemented: upload, play, download, playlists, public/private rooms + codes,
default MEMBER role, promote/demote, ELDER song control, MEMBER restrictions, host/elder
queue additions (songs + playlists), DB-enforced duplicate prevention, synchronized
playback across users (new joiners, seeks, song changes, play/pause), reconnection
resync, host disconnect migration, server-side permission enforcement, responsive UI,
loading/error/empty states. Not testable outside a real deployment: multi-client
synchronization itself — verify manually per the Quick Start above once running.

## 6. Local verification commands

From the monorepo root, run `npm run prisma:generate`, `npm run lint`, `npm test`,
`npm run build:server`, and `npm run build:web`. The web production build needs HTTPS `NEXT_PUBLIC_API_URL` and
`NEXT_PUBLIC_SOCKET_URL`, plus the Google web client ID; set these as build-time
environment values. See [DEPLOYMENT.md](DEPLOYMENT.md) before preparing a production release.
