import { createHmac, randomBytes, randomInt, timingSafeEqual } from "crypto";
import { prisma } from "@/db/prisma";
import { redis } from "@/redis/client";
import { env } from "@/config/env";
import { hashPassword, verifyPassword } from "@/auth/password";
import { signAccessToken, signRefreshToken } from "@/auth/jwt";
import { AppError, ConflictError, UnauthorizedError } from "@/utils/errors";
import { sendEmailChangeVerification, sendLoginCodeEmail, sendPasswordResetEmail } from "@/services/emailService";

const PUBLIC_USER_SELECT = { 
  id: true, 
  username: true, 
  email: true, 
  profileImage: true, 
  isAdmin: true, 
  createdAt: true,
} as const;

export async function registerUser(input: { username: string; email: string; password: string }) {
  const email = input.email.trim().toLowerCase();
  const existing = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: email, mode: "insensitive" } }, { username: input.username }] },
  });
  if (existing) {
    throw new ConflictError(
      existing.email.toLowerCase() === email ? "Email already in use" : "Username already taken"
    );
  }

  const passwordHash = await hashPassword(input.password);
  const user = await prisma.user.create({
    data: { username: input.username, email, passwordHash },
    select: { id: true, username: true, isAdmin: true, tokenVersion: true },
  });

  return issueSession(user.id, user.username, user.isAdmin, user.tokenVersion);
}

export async function loginUser(input: { emailOrUsername: string; password: string }) {
  const emailOrUsername = input.emailOrUsername.trim();
  const user = await prisma.user.findFirst({
    where: { OR: [{ email: { equals: emailOrUsername, mode: "insensitive" } }, { username: emailOrUsername }] },
  });
  if (!user) throw new UnauthorizedError("Invalid credentials");

  if (!user.passwordHash) { throw new UnauthorizedError("This account doesn't have a password — try signing in with Google or an email code instead"); } 
  const ok = await verifyPassword(input.password, user.passwordHash); 
  if (!ok) throw new UnauthorizedError("Invalid credentials");

  const session = issueSession(user.id, user.username, user.isAdmin, user.tokenVersion);
  const { passwordHash: _omitPassword, googleId: _omitGoogleId, tokenVersion: _omitTokenVersion, ...publicUser } = user;
  return { ...session, user: publicUser };
}

export function issueSession(userId: string, username: string, isAdmin: boolean, tokenVersion = 0) {
  const accessToken = signAccessToken({ sub: userId, username, isAdmin, tokenVersion });
  const refreshToken = signRefreshToken({ sub: userId, tokenVersion });
  return { accessToken, refreshToken };
}

export async function getUserPublicProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PUBLIC_USER_SELECT });
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  return user;
}

export async function updateProfile(
  userId: string,
  input: { username?: string; profileImage?: string }
) {
  if (input.username) {
    const clash = await prisma.user.findFirst({
      where: {
        AND: [
          { id: { not: userId } },
          { username: input.username },
        ],
      },
    });
    if (clash) throw new ConflictError("Username or email already in use");
  }

  return prisma.user.update({
    where: { id: userId },
    data: input,
    select: PUBLIC_USER_SELECT,
  });
}

export async function changePassword(userId: string, currentPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new AppError("User not found", 404, "NOT_FOUND");
  if (!user.passwordHash) throw new UnauthorizedError("This account does not have a password set");

  const ok = await verifyPassword(currentPassword, user.passwordHash);
  if (!ok) throw new UnauthorizedError("Current password is incorrect");

  const passwordHash = await hashPassword(newPassword);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
}

const SECURITY_TOKEN_TTL_MS = 30 * 60 * 1000;
const SECURITY_EMAIL_COOLDOWN_SECONDS = 60;
const RESET_RESPONSE_MIN_MS = 350;

async function normalizeResetResponseTiming(startedAt: number) {
  const delay = RESET_RESPONSE_MIN_MS - (Date.now() - startedAt);
  if (delay > 0) await new Promise((resolve) => setTimeout(resolve, delay));
}

function hashSecurityToken(purpose: string, token: string): string {
  return createHmac("sha256", env.jwtRefreshSecret).update(`${purpose}:${token}`).digest("hex");
}

function cooldownKey(purpose: string, identity: string): string {
  const digest = createHmac("sha256", env.jwtRefreshSecret).update(identity.trim().toLowerCase()).digest("hex");
  return `security-email:${purpose}:${digest}`;
}

async function claimEmailCooldown(purpose: string, identity: string): Promise<boolean> {
  return (await redis.set(cooldownKey(purpose, identity), "1", "EX", SECURITY_EMAIL_COOLDOWN_SECONDS, "NX")) === "OK";
}

export async function requestPasswordReset(rawEmail: string): Promise<void> {
  const startedAt = Date.now();
  const email = rawEmail.trim().toLowerCase();
  if (!(await claimEmailCooldown("password-reset", email))) {
    await normalizeResetResponseTiming(startedAt);
    return;
  }

  const user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user?.passwordHash) {
    await normalizeResetResponseTiming(startedAt);
    return; // Google-only accounts do not have a password to reset.
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSecurityToken("password-reset", token);
  const expiresAt = new Date(Date.now() + SECURITY_TOKEN_TTL_MS);
  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.passwordResetToken.create({ data: { token: tokenHash, userId: user.id, expiresAt } }),
  ]);

  void sendPasswordResetEmail(email, token).catch(async (error) => {
    await prisma.passwordResetToken.updateMany({ where: { token: tokenHash, usedAt: null }, data: { usedAt: new Date() } }).catch(() => undefined);
    console.warn("[auth] password reset email delivery failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
  });
  await normalizeResetResponseTiming(startedAt);
}

export async function resetPassword(token: string, newPassword: string) {
  const tokenHash = hashSecurityToken("password-reset", token);
  const now = new Date();
  const record = await prisma.passwordResetToken.findUnique({ where: { token: tokenHash } });
  if (!record || record.usedAt || record.expiresAt <= now) throw new UnauthorizedError("Invalid or expired reset token");
  const passwordHash = await hashPassword(newPassword);
  await prisma.$transaction(async (tx) => {
    const consumed = await tx.passwordResetToken.updateMany({ where: { id: record.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
    if (consumed.count !== 1) throw new UnauthorizedError("Invalid or expired reset token");
    await tx.user.update({ where: { id: record.userId }, data: { passwordHash, tokenVersion: { increment: 1 } } });
  });
}

export async function requestEmailChange(userId: string, rawEmail: string): Promise<void> {
  const newEmail = rawEmail.trim().toLowerCase();
  if (!(await claimEmailCooldown("email-change", userId))) throw new AppError("Please wait before requesting another verification email", 429, "RATE_LIMITED");

  const currentUser = await prisma.user.findUnique({ where: { id: userId }, select: { email: true } });
  if (!currentUser) throw new AppError("User not found", 404, "NOT_FOUND");
  if (currentUser.email.toLowerCase() === newEmail) throw new AppError("That is already your current email", 400, "EMAIL_UNCHANGED");

  const existing = await prisma.user.findFirst({ where: { email: { equals: newEmail, mode: "insensitive" }, id: { not: userId } }, select: { id: true } });
  if (existing) throw new ConflictError("Email already in use");

  const token = randomBytes(32).toString("base64url");
  const tokenHash = hashSecurityToken("email-change", token);
  const expiresAt = new Date(Date.now() + SECURITY_TOKEN_TTL_MS);
  await prisma.$transaction([
    prisma.emailChangeVerification.updateMany({ where: { userId, usedAt: null }, data: { usedAt: new Date() } }),
    prisma.emailChangeVerification.create({ data: { userId, newEmail, tokenHash, expiresAt } }),
  ]);

  try {
    await sendEmailChangeVerification(newEmail, token);
  } catch (error) {
    await prisma.emailChangeVerification.updateMany({ where: { tokenHash, usedAt: null }, data: { usedAt: new Date() } }).catch(() => undefined);
    console.warn("[auth] email change verification delivery failed", { errorName: error instanceof Error ? error.name : "UnknownError" });
    throw new AppError("Could not send the verification email. Please try again later.", 503, "EMAIL_DELIVERY_FAILED");
  }
}

export async function verifyEmailChange(token: string): Promise<void> {
  const now = new Date();
  const tokenHash = hashSecurityToken("email-change", token);
  const pending = await prisma.emailChangeVerification.findUnique({ where: { tokenHash } });
  if (!pending || pending.usedAt || pending.expiresAt <= now) throw new UnauthorizedError("Invalid or expired verification link");

  const existing = await prisma.user.findFirst({ where: { email: { equals: pending.newEmail, mode: "insensitive" }, id: { not: pending.userId } }, select: { id: true } });
  if (existing) throw new ConflictError("Email already in use");

  try {
    await prisma.$transaction(async (tx) => {
      const consumed = await tx.emailChangeVerification.updateMany({ where: { id: pending.id, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
      if (consumed.count !== 1) throw new UnauthorizedError("Invalid or expired verification link");
      await tx.user.update({ where: { id: pending.userId }, data: { email: pending.newEmail, tokenVersion: { increment: 1 } } });
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") throw new ConflictError("Email already in use");
    throw error;
  }
}

async function generateUniqueUsername(base: string): Promise<string> {
  const cleaned = base.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 20) || 'user';
  let suffix = 0;
  while (true) {
    suffix += 1;
    const tail = suffix === 1 ? '' : String(suffix - 1);
    const username = `${cleaned.slice(0, 24 - tail.length)}${tail}`;
    if (!(await prisma.user.findUnique({ where: { username } }))) return username;
  }
}

export async function loginOrRegisterWithGoogle(input: {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}) {
  const email = input.email.trim().toLowerCase();
  let user = await prisma.user.findUnique({ where: { googleId: input.googleId } });

  if (!user) {
    const existing = await prisma.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });
    if (existing?.googleId && existing.googleId !== input.googleId) {
      throw new ConflictError('This email is already linked to another Google account');
    }
    if (existing) {
      user = await prisma.user.update({
        where: { id: existing.id },
        data: { googleId: input.googleId, profileImage: existing.profileImage ?? input.picture },
      });
    } else {
      const username = await generateUniqueUsername(input.name || email.split('@')[0]);
      user = await prisma.user.create({
        data: { username, email, googleId: input.googleId, profileImage: input.picture },
      });
    }
  }

  return issueSession(user.id, user.username, user.isAdmin, user.tokenVersion);
}

const CODE_TTL_MINUTES = 10;
const CODE_SEND_COOLDOWN_SECONDS = 60;

function hashEmailLoginCode(email: string, code: string): string {
  return createHmac('sha256', env.jwtRefreshSecret).update(`${email}:${code}`).digest('hex');
}

export async function requestEmailLoginCode(rawEmail: string) {
  const email = rawEmail.trim().toLowerCase();
  const code = randomInt(100000, 1000000).toString();
  const cooldownKey = `auth:email-code:send:${createHmac('sha256', env.jwtRefreshSecret).update(email).digest('hex')}`;
  const locked = await redis.set(cooldownKey, '1', 'EX', CODE_SEND_COOLDOWN_SECONDS, 'NX');
  if (locked !== 'OK') throw new AppError('Please wait before requesting another code', 429, 'RATE_LIMITED');

  const now = new Date();
  await prisma.$transaction([
    prisma.emailLoginCode.updateMany({ where: { email, usedAt: null }, data: { usedAt: now } }),
    prisma.emailLoginCode.create({
      data: {
        email,
        code: hashEmailLoginCode(email, code),
        expiresAt: new Date(now.getTime() + CODE_TTL_MINUTES * 60 * 1000),
      },
    }),
  ]);

  try {
    await sendLoginCodeEmail(email, code);
  } catch {
    await prisma.emailLoginCode.updateMany({
      where: { email, code: hashEmailLoginCode(email, code), usedAt: null },
      data: { usedAt: new Date() },
    }).catch(() => undefined);
    await redis.del(cooldownKey).catch(() => undefined);
    throw new AppError('Could not send the sign-in code. Please try again later.', 503, 'EMAIL_DELIVERY_FAILED');
  }
}

export async function verifyEmailLoginCode(rawEmail: string, rawCode: string) {
  const email = rawEmail.trim().toLowerCase();
  const code = rawCode.trim();
  const now = new Date();
  const record = await prisma.emailLoginCode.findFirst({
    where: { email, usedAt: null, expiresAt: { gt: now } },
    orderBy: { createdAt: 'desc' },
  });
  if (!record || record.attempts >= 5) throw new UnauthorizedError('Invalid or expired code');

  const expected = Buffer.from(record.code, 'hex');
  const provided = Buffer.from(hashEmailLoginCode(email, code), 'hex');
  const matches = expected.length === provided.length && timingSafeEqual(expected, provided);
  if (!matches) {
    await prisma.emailLoginCode.updateMany({
      where: { id: record.id, usedAt: null, attempts: { lt: 5 } },
      data: { attempts: { increment: 1 }, ...(record.attempts >= 4 ? { usedAt: now } : {}) },
    });
    throw new UnauthorizedError('Invalid or expired code');
  }

  const consumed = await prisma.emailLoginCode.updateMany({
    where: { id: record.id, usedAt: null, expiresAt: { gt: now }, attempts: { lt: 5 } },
    data: { usedAt: now },
  });
  if (consumed.count !== 1) throw new UnauthorizedError('Invalid or expired code');

  let user = await prisma.user.findFirst({ where: { email: { equals: email, mode: "insensitive" } } });
  if (!user) {
    const username = await generateUniqueUsername(email.split('@')[0]);
    user = await prisma.user.create({ data: { username, email } });
  }
  return issueSession(user.id, user.username, user.isAdmin, user.tokenVersion);
}
