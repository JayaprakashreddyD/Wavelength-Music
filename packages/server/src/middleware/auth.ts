import { NextFunction, Request, Response } from "express";
import { getCurrentUserForAccessToken } from "@/auth/session";
import { env } from "@/config/env";
import { ForbiddenError, UnauthorizedError } from "@/utils/errors";

export interface AuthedRequest extends Request {
  userId?: string;
  username?: string;
}

// Reads the access token from either the Authorization header or the
// httpOnly cookie set at login, so the same middleware works for a
// browser session and for API clients using bearer tokens.
export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookieToken = (req as any).cookies?.access_token as string | undefined;
  const token = bearer ?? cookieToken;

  if (!token) {
    throw new UnauthorizedError("Missing access token");
  }

  // SameSite cookies mitigate cross-site requests; verify Origin as an
  // additional guard for state-changing requests authenticated by cookies.
  if (!bearer && cookieToken && !["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.get("origin");
    if (origin && !env.corsOrigins.includes(origin)) {
      throw new ForbiddenError("Request origin is not allowed");
    }
  }

  let payload;
  try {
    payload = await getCurrentUserForAccessToken(token);
  } catch {
    throw new UnauthorizedError("Invalid or expired access token");
  }
  if (!payload) throw new UnauthorizedError("Session has expired");
  req.userId = payload.sub;
  req.username = payload.username;
  next();
}

// Like requireAuth but does not throw if there's no token — used for
// endpoints that behave slightly differently for logged-in users
// but are otherwise public.
export async function optionalAuth(req: AuthedRequest, _res: Response, next: NextFunction) {
  const header = req.headers.authorization;
  const bearer = header?.startsWith("Bearer ") ? header.slice(7) : undefined;
  const cookieToken = (req as any).cookies?.access_token as string | undefined;
  const token = bearer ?? cookieToken;

  if (token) {
    try {
      const payload = await getCurrentUserForAccessToken(token);
      if (payload) {
        req.userId = payload.sub;
        req.username = payload.username;
      }
    } catch {
      // ignore invalid token for optional auth
    }
  }
  next();
}
