# REST API

The API prefix is `/api`. Production requests use the public Render URL, for example `https://<api-host>/api`. JSON endpoints return JSON unless noted. Authentication sets `HttpOnly` access and refresh cookies; most protected routes also accept `Authorization: Bearer <accessToken>`.

## Authentication

| Method | Path | Auth | Body / result |
|---|---|---|---|
| POST | `/auth/register` | No | `{ "username", "email", "password" }`; returns `201 { accessToken }` and sets session cookies. |
| POST | `/auth/login` | No | `{ "email", "password" }`; returns `{ accessToken, user }`. |
| POST | `/auth/google` | No | `{ "credential": "<Google ID token>" }`; verifies Google's token and verified email, then returns `{ accessToken }`. |
| POST | `/auth/request-code` | No | `{ "email" }`; emails a one-time sign-in code. |
| POST | `/auth/verify-code` | No | `{ "email", "code" }`; consumes the code and establishes a session. |
| POST | `/auth/refresh` | Refresh cookie | Issues a new access token. |
| POST | `/auth/logout` | Refresh cookie | Revokes the current token version and clears cookies; `204`. |
| GET | `/auth/me` | Yes | Returns `{ user }`. |
| POST | `/auth/forgot-password` | No | `{ "email" }`; sends a single-use reset link when a password account exists and always returns a generic message. |
| POST | `/auth/request-password-reset` | No | Backwards-compatible alias for `/auth/forgot-password`. |
| POST | `/auth/reset-password` | No | `{ "token", "newPassword" }`; consumes a 30-minute token and revokes existing sessions. |
| POST | `/auth/verify-email-change` | No | `{ "token" }`; consumes the email-change token, updates the address, and revokes sessions. |

Auth endpoints are rate limited. Email codes expire and have a bounded number of attempts; reset and email-change links expire after 30 minutes. Verification/reset tokens are stored as keyed hashes and are never returned by the API. Email delivery requires `EMAIL_USER`, `EMAIL_APP_PASSWORD`, and `WEB_APP_URL` on the API server.

## Songs

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/songs` | Optional | Shared, paginated library. Query supports `page`, `limit` (up to 100), `sort`, and search/filter fields validated by the server. |
| GET | `/songs/mine` | Yes | Current user's uploads; accepts the same pagination/sort options. |
| GET | `/songs/recently-added` | No | Recently added shared tracks. |
| GET | `/songs/recommended` | Yes | Recommendations for the current user. |
| GET | `/songs/:id` | No | Song metadata. |
| POST | `/songs/upload` or `/songs` | Yes | `multipart/form-data`: required `audio`, optional `artwork`, and text fields `title`, `artist`, `album`, `genre`. Returns `201 { success, song }`. File content is inspected; limits are configured with `MAX_AUDIO_FILE_SIZE_MB` and `MAX_ARTWORK_FILE_SIZE_MB`. |
| PATCH | `/songs/:id` | Owner/admin | JSON fields to update: `title`, `artist`, `album`, `genre`; at least one is required. |
| DELETE | `/songs/:id` | Owner/admin | Deletes metadata and stored objects; `204`. |
| POST | `/songs/:id/play` | Yes | Records a play; `204`. |
| POST | `/songs/:id/download` | Yes | Records a download and returns `{ downloadUrl, filename }`. |
| POST | `/songs/:id/like` | Yes | Likes the song; `204`. |
| DELETE | `/songs/:id/like` | Yes | Removes the like; `204`. |

## Users

All `/users` routes require authentication.

| Method | Path | Body / result |
|---|---|---|
| PATCH | `/users/me` | Updates profile fields accepted by `updateProfileSchema` (`username`); returns `{ user }`. |
| POST | `/users/me/email-change` | `{ "email" }`; sends a verification link to the new address. Current email is unchanged until `/auth/verify-email-change` succeeds. |
| POST | `/users/me/avatar` | Multipart field `avatar`; returns `{ user }`. |
| POST | `/users/me/change-password` | `{ "currentPassword", "newPassword" }`; `204`. |
| GET | `/users/me/downloads` | Returns `{ items }`. |
| DELETE | `/users/me/downloads/:songId` | Removes the download record; `204`. |
| GET | `/users/me/liked-songs` | Returns `{ items }`. |
| GET | `/users/me/liked-song-ids` | Returns `{ ids }`. |
| GET | `/users/me/recently-played` | Returns up to 20 distinct recently played songs in `{ items }`. |

## Playlists

All `/playlists` routes require authentication and are scoped to the playlist owner.

| Method | Path | Body / result |
|---|---|---|
| GET | `/playlists` | Returns `{ items }` for the current user. |
| POST | `/playlists` | Create with fields accepted by `createPlaylistSchema`; `201 { playlist }`. |
| GET | `/playlists/:id` | Returns `{ playlist }` including songs. |
| PATCH | `/playlists/:id` | Rename/update fields accepted by `updatePlaylistSchema`; returns `{ playlist }`. |
| DELETE | `/playlists/:id` | Deletes the playlist; `204`. |
| POST | `/playlists/:id/songs` | `{ "songId" }`; adds a song and returns `201 { entry }`. |
| DELETE | `/playlists/:id/songs/:songId` | Removes a song; `204`. |
| PUT | `/playlists/:id/order` | `{ "orderedSongIds": [...] }`; reorders songs; `204`. |

## Rooms

All `/rooms` routes require authentication. Role-based room actions are checked server-side.

| Method | Path | Body / result |
|---|---|---|
| GET | `/rooms` | Lists public rooms. |
| POST | `/rooms` | Create a room using fields accepted by `createRoomSchema`; `201 { room }`. |
| POST | `/rooms/join` | `{ "code" }`; joins a private room, returns `{ membership }`. |
| POST | `/rooms/:id/join` | Joins a public room; returns `{ membership }`. |
| GET | `/rooms/mine` | Returns `{ items }` for the user's rooms. |
| GET | `/rooms/:id` | Returns `{ room }`; private room codes are visible only to members. |
| GET | `/rooms/:id/members` | Returns `{ items }`. |
| GET | `/rooms/:id/queue` | Returns `{ items }`. |
| GET | `/rooms/:id/playback` | Returns playback snapshot, computed position, and server timestamp. |
| POST | `/rooms/:id/queue/songs` | `{ "songIds": [...] }`; privileged roles add songs; returns add/duplicate counts and queue. |
| POST | `/rooms/:id/queue/playlists` | `{ "playlistId" }`; privileged roles add a playlist to queue. |
| DELETE | `/rooms/:id/queue/songs/:songId` | Removes a queued song if the caller has permission. |
| POST | `/rooms/:id/members/:userId/promote` | Promotes a member; returns `{ member }`. |
| POST | `/rooms/:id/members/:userId/demote` | Demotes a member; returns `{ member }`. |
| DELETE | `/rooms/:id/members/:userId` | Removes a member; `204`. |
| POST | `/rooms/:id/leave` | Leaves the room; returns `{ result }`. |
| POST | `/rooms/:id/end` | Ends the room if permitted; `204`. |

Real-time playback and room events are also handled through Socket.IO. Event names and permission rules are in `packages/server/src/sockets/` and `packages/server/src/sockets/permissions.ts`.

## Health

`GET /health` returns `{ success: true, ok: true }`; configure the platform health check to `/api/health`.

Room socket events and permission rules are documented in `packages/server/src/sockets/` and `packages/server/src/sockets/permissions.ts`.

## Errors

Errors use `{ "success": false, "error": { "code": "...", "message": "..." } }`. Common statuses are `400` validation error, `401` missing/invalid session, `403` insufficient permission, `404` missing resource, `409` uniqueness conflict, `413` upload too large, `422` invalid media, `429` rate limited, and `5xx` service errors. Do not expose server secrets or database details in client error messages.
