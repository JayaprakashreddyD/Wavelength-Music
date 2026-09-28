const test = require("node:test");
const assert = require("node:assert/strict");

process.env.NODE_ENV = "test";
process.env.DATABASE_URL ||= "postgresql://test:test@127.0.0.1:5432/test";
process.env.REDIS_URL ||= "redis://127.0.0.1:6379";
process.env.JWT_ACCESS_SECRET ||= "test_access_secret_32_characters_long";
process.env.JWT_REFRESH_SECRET ||= "test_refresh_secret_32_characters_long";
process.env.S3_ENDPOINT ||= "http://127.0.0.1:9000";
process.env.S3_ACCESS_KEY_ID ||= "test";
process.env.S3_SECRET_ACCESS_KEY ||= "test";
process.env.S3_BUCKET ||= "test";
process.env.S3_PUBLIC_URL ||= "http://127.0.0.1:9000/test";
process.env.GOOGLE_CLIENT_ID ||= "test.apps.googleusercontent.com";
process.env.EMAIL_USER ||= "test@example.com";
process.env.EMAIL_APP_PASSWORD ||= "test-app-password";
process.env.WEB_APP_URL ||= "http://localhost:3000";

require("express-async-errors");
const express = require("express");
const { prisma } = require("../dist/db/prisma");
const { redis, redisPub, redisSub } = require("../dist/redis/client");
const mailer = require("../dist/services/emailService");
const storage = require("../dist/storage/s3");
const users = require("../dist/services/userService");
const songs = require("../dist/services/songService");
const { hashPassword, verifyPassword } = require("../dist/auth/password");
const { isSessionCurrent, revokeRefreshSession, getCurrentUserForAccessToken } = require("../dist/auth/session");
const { errorHandler } = require("../dist/middleware/errorHandler");
const { songsRouter } = require("../dist/routes/songs.routes");
const { signRefreshToken, signAccessToken } = require("../dist/auth/jwt");
const { env } = require("../dist/config/env");
const jwt = require("jsonwebtoken");

function stubPrisma(t, replacements) {
  const descriptors = new Map();
  for (const [name, value] of Object.entries(replacements)) {
    descriptors.set(name, Object.getOwnPropertyDescriptor(prisma, name));
    Object.defineProperty(prisma, name, { configurable: true, writable: true, value });
  }
  t.after(() => {
    for (const [name, descriptor] of descriptors) {
      if (descriptor) Object.defineProperty(prisma, name, descriptor);
      else delete prisma[name];
    }
  });
}

function userModel(methods) { return methods; }

test.after(async () => {
  redis.disconnect();
  redisPub.disconnect();
  redisSub.disconnect();
  await prisma.$disconnect();
});

test("registration hashes passwords and password login creates a session", async (t) => {
  let lookedUpUser = null;
  let created;
  stubPrisma(t, { user: userModel({
    findFirst: async () => lookedUpUser,
    create: async ({ data }) => { created = data; return { id: "user-1", username: data.username, isAdmin: false, tokenVersion: 0 }; },
  }) });
  const registered = await users.registerUser({ username: "listener", email: "LISTENER@example.com", password: "correct horse battery" });
  assert.equal(created.email, "listener@example.com");
  assert.notEqual(created.passwordHash, "correct horse battery");
  assert.equal(await verifyPassword("correct horse battery", created.passwordHash), true);
  assert.ok(registered.accessToken);
  assert.ok(registered.refreshToken);

  const passwordHash = await hashPassword("correct horse battery");
  lookedUpUser = { id: "user-1", username: "listener", email: "listener@example.com", isAdmin: false, tokenVersion: 2, passwordHash, googleId: null, profileImage: null, createdAt: new Date() };
  const session = await users.loginUser({ emailOrUsername: "listener@example.com", password: "correct horse battery" });
  assert.equal(session.user.id, "user-1");
  assert.equal("passwordHash" in session.user, false);
  assert.ok(session.accessToken);
});

test("Google sign-in links a verified matching email but rejects a different linked identity", async (t) => {
  let existing = { id: "existing", username: "listener", email: "listener@example.com", googleId: null, isAdmin: false, tokenVersion: 0, profileImage: null };
  let linked;
  stubPrisma(t, { user: userModel({
    findUnique: async () => null,
    findFirst: async () => existing,
    update: async ({ data }) => { linked = data; return { id: "existing", username: "listener", isAdmin: false, tokenVersion: 0 }; },
  }) });
  const session = await users.loginOrRegisterWithGoogle({ googleId: "google-subject", email: "listener@example.com", name: "Listener" });
  assert.equal(linked.googleId, "google-subject");
  assert.ok(session.accessToken);
  existing = { id: "existing", googleId: "different-google-subject" };
  await assert.rejects(() => users.loginOrRegisterWithGoogle({ googleId: "google-subject", email: "listener@example.com", name: "Listener" }), /already linked/);
});

test("Google-only accounts cannot use password login until a password exists", async (t) => {
  stubPrisma(t, { user: userModel({ findFirst: async () => ({ id: "google-user", passwordHash: null }) }) });
  await assert.rejects(() => users.loginUser({ emailOrUsername: "google@example.com", password: "anything" }), /doesn't have a password/);
});

test("session validation rejects expired and revoked tokens; logout revokes the current token version", async (t) => {
  let storedVersion = 4;
  let revoked;
  stubPrisma(t, { user: userModel({
    findUnique: async () => ({ tokenVersion: storedVersion }),
    updateMany: async (args) => { revoked = args; storedVersion += 1; return { count: 1 }; },
  }) });
  assert.equal(await isSessionCurrent("user-1", 4), true);
  assert.equal(await isSessionCurrent("user-1", 3), false);
  const expiredToken = jwt.sign({ sub: "user-1", username: "listener", isAdmin: false, tokenVersion: 4 }, env.jwtAccessSecret, { expiresIn: -1 });
  await assert.rejects(() => getCurrentUserForAccessToken(expiredToken));
  await revokeRefreshSession(signRefreshToken({ sub: "user-1", tokenVersion: 4 }));
  assert.deepEqual(revoked.where, { id: "user-1", tokenVersion: 4 });
  assert.equal(await isSessionCurrent("user-1", 4), false);
  await revokeRefreshSession("invalid-refresh-token");
});

test("password reset stores only a hash, expires, consumes once, and revokes sessions", async (t) => {
  const account = { id: "user-1", email: "listener@example.com", passwordHash: "old-hash" };
  let stored;
  let emailedToken;
  let consumed = false;
  let expired = false;
  let userUpdate;
  stubPrisma(t, {
    user: userModel({ findFirst: async () => account, update: async (args) => { userUpdate = args; return {}; } }),
    passwordResetToken: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }) => { stored = data; return data; },
      findUnique: async ({ where }) => where.token === stored.token && !consumed ? { id: "reset-1", userId: account.id, usedAt: null, expiresAt: new Date(Date.now() + (expired ? -10000 : 10000)) } : null,
    },
    $transaction: async (ops) => typeof ops === "function" ? ops({
      passwordResetToken: { updateMany: async () => { if (consumed) return { count: 0 }; consumed = true; return { count: 1 }; } },
      user: { update: async (args) => { userUpdate = args; return {}; } },
    }) : Promise.all(ops),
  });
  Object.defineProperty(redis, "set", { configurable: true, value: async () => "OK" });
  t.after(() => { delete redis.set; });
  t.mock.method(mailer, "sendPasswordResetEmail", async (_email, token) => { emailedToken = token; });
  const resetResponse = await users.requestPasswordReset(account.email);
  assert.equal(resetResponse, undefined);
  assert.equal(stored.token.length, 64);
  assert.notEqual(stored.token, emailedToken);
  assert.ok(stored.expiresAt.getTime() > Date.now());
  expired = true;
  await assert.rejects(() => users.resetPassword(emailedToken, "new password long enough"), /Invalid or expired/);
  expired = false;
  await users.resetPassword(emailedToken, "new password long enough");
  assert.equal(userUpdate.data.tokenVersion.increment, 1);
  assert.equal(await verifyPassword("new password long enough", userUpdate.data.passwordHash), true);
  await assert.rejects(() => users.resetPassword(emailedToken, "another password long enough"), /Invalid or expired/);
});

test("email change stores a token hash, waits for verification, and revokes sessions", async (t) => {
  let pending;
  let emailedToken;
  let consumed = false;
  let changed;
  stubPrisma(t, {
    user: userModel({
      findUnique: async () => ({ email: "old@example.com" }),
      findFirst: async () => null,
      update: async (args) => { changed = args; return {}; },
    }),
    emailChangeVerification: {
      updateMany: async () => ({ count: 1 }),
      create: async ({ data }) => { pending = { ...data, id: "verify-1", usedAt: null }; return pending; },
      findUnique: async () => pending,
    },
    $transaction: async (ops) => typeof ops === "function" ? ops({
      emailChangeVerification: { updateMany: async () => { if (consumed) return { count: 0 }; consumed = true; return { count: 1 }; } },
      user: { update: async (args) => { changed = args; return {}; } },
    }) : Promise.all(ops),
  });
  Object.defineProperty(redis, "set", { configurable: true, value: async () => "OK" });
  t.after(() => { delete redis.set; });
  t.mock.method(mailer, "sendEmailChangeVerification", async (_email, token) => { emailedToken = token; });
  await users.requestEmailChange("user-1", "NEW@example.com");
  assert.equal(changed, undefined, "the database email must remain unchanged until verification");
  assert.equal(pending.newEmail, "new@example.com");
  assert.notEqual(pending.tokenHash, emailedToken);
  assert.ok(pending.expiresAt.getTime() > Date.now());
  pending.expiresAt = new Date(Date.now() - 1000);
  await assert.rejects(() => users.verifyEmailChange(emailedToken), /Invalid or expired/);
  pending.expiresAt = new Date(Date.now() + 10000);
  await users.verifyEmailChange(emailedToken);
  assert.equal(changed.data.email, "new@example.com");
  assert.equal(changed.data.tokenVersion.increment, 1);
  pending.usedAt = new Date();
  await assert.rejects(() => users.verifyEmailChange(emailedToken), /Invalid or expired/);
});

test("song management and deletion are limited to owners and admins", async (t) => {
  let admin = false;
  let deletedObjects = 0;
  let deletedRecord = false;
  const song = { id: "song-1", uploadedById: "owner-1", audioStorageKey: "audio/file.mp3", artworkStorageKey: null, artworkUrl: null };
  stubPrisma(t, {
    song: { findUnique: async () => song, delete: async () => { deletedRecord = true; return song; } },
    user: { findUnique: async () => ({ isAdmin: admin }) },
  });
  t.mock.method(storage, "deleteObject", async () => { deletedObjects += 1; });
  await songs.assertCanManageSong("song-1", "owner-1");
  await assert.rejects(() => songs.assertCanManageSong("song-1", "other-user"), /only manage your own/);
  admin = true;
  await songs.assertCanManageSong("song-1", "admin-user");
  admin = false;
  await assert.rejects(() => songs.deleteSongForUser("song-1", "other-user"), /only manage your own/);
  assert.equal(deletedObjects, 0);
  await songs.deleteSongForUser("song-1", "owner-1");
  assert.equal(deletedObjects, 1);
  assert.equal(deletedRecord, true);
});

test("song upload route rejects anonymous requests before upload middleware", async (t) => {
  const app = express();
  app.use(express.json());
  app.use("/api/songs", songsRouter);
  app.use(errorHandler);
  const server = app.listen(0);
  t.after(() => new Promise((resolve) => server.close(resolve)));
  await new Promise((resolve) => server.once("listening", resolve));
  const address = server.address();
  const response = await fetch(`http://127.0.0.1:${address.port}/api/songs/upload`, { method: "POST" });
  assert.equal(response.status, 401);
  const body = await response.json();
  assert.equal(body.error.code, "UNAUTHORIZED");
});
