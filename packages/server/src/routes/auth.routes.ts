import { CookieOptions, NextFunction, Request, Response, Router } from "express";
import { env } from "@/config/env";
import { validate } from "@/middleware/validate";
import { authLimiter } from "@/middleware/rateLimit";
import { requireAuth, AuthedRequest } from "@/middleware/auth";
import {
  loginSchema,
  registerSchema,
  requestPasswordResetSchema,
  resetPasswordSchema,
  googleAuthSchema,
  requestEmailCodeSchema,
  verifyEmailCodeSchema,
  verifyEmailChangeSchema,
} from "@/validators/auth";
import { OAuth2Client } from "google-auth-library"; 
import * as userService from "@/services/userService";
import { signAccessToken, verifyRefreshToken } from "@/auth/jwt";
import { revokeRefreshSession } from "@/auth/session";
import { prisma } from "@/db/prisma";
import { ForbiddenError, UnauthorizedError } from "@/utils/errors";

export const authRouter = Router();
const googleClient = new OAuth2Client(env.google.clientId);

const COOKIE_OPTS: CookieOptions = {
  httpOnly: true,
  secure: env.cookie.secure,
  sameSite: env.cookie.sameSite,
  path: env.cookie.path,
  ...(env.cookie.domain ? { domain: env.cookie.domain } : {}),
};

function setAuthCookies(res: Response, accessToken: string, refreshToken: string) {
  res.cookie("access_token", accessToken, { ...COOKIE_OPTS, maxAge: env.jwtAccessMaxAgeMs });
  res.cookie("refresh_token", refreshToken, { ...COOKIE_OPTS, maxAge: env.jwtRefreshMaxAgeMs });
}

function clearAuthCookies(res: Response) {
  res.clearCookie("access_token", COOKIE_OPTS);
  res.clearCookie("refresh_token", COOKIE_OPTS);
}

function allowConfiguredOrigin(req: Request, _res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin && !env.corsOrigins.includes(origin)) return next(new ForbiddenError("Request origin is not allowed"));
  next();
}

authRouter.post("/register", authLimiter, validate(registerSchema), async (req, res) => {
  const { accessToken, refreshToken } = await userService.registerUser(req.body);
  setAuthCookies(res, accessToken, refreshToken);
  res.status(201).json({ accessToken });
});

authRouter.post("/login", authLimiter, validate(loginSchema), async (req, res) => {
  const { accessToken, refreshToken, user } = await userService.loginUser(req.body);
  setAuthCookies(res, accessToken, refreshToken);
  res.json({ accessToken, user });
});

authRouter.post("/logout", authLimiter, allowConfiguredOrigin, async (_req, res) => {
  const refreshToken = _req.cookies?.refresh_token as string | undefined;
  if (refreshToken) await revokeRefreshSession(refreshToken);
  clearAuthCookies(res);
  res.status(204).send();
});

authRouter.post("/refresh", allowConfiguredOrigin, async (req, res) => {
  const token = req.cookies?.refresh_token;
  if (!token) throw new UnauthorizedError("Missing refresh token");

  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new UnauthorizedError("Invalid refresh token");
  }

  // Access token needs a username; refetch it rather than trusting a stale claim.
  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, username: true, isAdmin: true, tokenVersion: true },
  });
  if (!user) throw new UnauthorizedError("User no longer exists");
  if ((payload.tokenVersion ?? 0) !== user.tokenVersion) throw new UnauthorizedError("Session has expired");

  const accessToken = signAccessToken({
    sub: user.id,
    username: user.username,
    isAdmin: user.isAdmin,
    tokenVersion: user.tokenVersion,
  });
  res.cookie("access_token", accessToken, { ...COOKIE_OPTS, maxAge: env.jwtAccessMaxAgeMs });
  res.json({ accessToken });
});

authRouter.post(
  "/forgot-password",
  authLimiter,
  validate(requestPasswordResetSchema),
  async (req, res) => {
    await userService.requestPasswordReset(req.body.email);
    // Same response regardless of whether the email exists.
    res.json({ message: "If that email is registered, a reset link has been sent." });
  }
);

// Backwards-compatible alias for earlier clients.
authRouter.post("/request-password-reset", authLimiter, validate(requestPasswordResetSchema), async (req, res) => {
  await userService.requestPasswordReset(req.body.email);
  res.json({ message: "If that email is registered, a reset link has been sent." });
});

authRouter.post("/reset-password", authLimiter, validate(resetPasswordSchema), async (req, res) => {
  await userService.resetPassword(req.body.token, req.body.newPassword);
  res.json({ message: "Password updated" });
});

authRouter.post("/verify-email-change", authLimiter, allowConfiguredOrigin, validate(verifyEmailChangeSchema), async (req, res) => {
  await userService.verifyEmailChange(req.body.token);
  res.json({ message: "Email address updated. Please sign in again." });
});

authRouter.get("/me", requireAuth, async (req: AuthedRequest, res) => {
  const user = await userService.getUserPublicProfile(req.userId!);
  res.json({ user });
});

authRouter.post("/google", authLimiter, validate(googleAuthSchema), async (req, res) => { const ticket = await googleClient.verifyIdToken({ idToken: req.body.credential, audience: env.google.clientId, }); const payload = ticket.getPayload(); if (!payload?.email || !payload.email_verified) throw new UnauthorizedError("Invalid Google token"); const { accessToken, refreshToken } = await userService.loginOrRegisterWithGoogle({ googleId: payload.sub, email: payload.email, name: payload.name ?? payload.email.split("@")[0], picture: payload.picture, }); setAuthCookies(res, accessToken, refreshToken); res.json({ accessToken }); }); authRouter.post("/request-code", authLimiter, validate(requestEmailCodeSchema), async (req, res) => { await userService.requestEmailLoginCode(req.body.email); res.json({ message: "Code sent" }); }); authRouter.post("/verify-code", authLimiter, validate(verifyEmailCodeSchema), async (req, res) => { const { accessToken, refreshToken } = await userService.verifyEmailLoginCode(req.body.email, req.body.code); setAuthCookies(res, accessToken, refreshToken); res.json({ accessToken }); });
