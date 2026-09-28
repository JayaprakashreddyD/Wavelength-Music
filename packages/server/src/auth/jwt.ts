import jwt from "jsonwebtoken";
import type { SignOptions } from "jsonwebtoken";
import { env } from "@/config/env";

export interface AccessTokenPayload { 
  sub: string; // userId 
  username: string; 
  isAdmin: boolean; 
  tokenVersion?: number;
}

export interface RefreshTokenPayload {
  sub: string; // userId
  tokenVersion?: number;
}

export function signAccessToken(payload: AccessTokenPayload): string {
  return jwt.sign(payload, env.jwtAccessSecret, {
    expiresIn: env.jwtAccessTtl as SignOptions["expiresIn"],
  });
}

export function signRefreshToken(payload: RefreshTokenPayload): string {
  return jwt.sign(payload, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshTtl as SignOptions["expiresIn"],
  });
}

export function verifyAccessToken(token: string): AccessTokenPayload {
  return jwt.verify(token, env.jwtAccessSecret) as AccessTokenPayload;
}

export function verifyRefreshToken(token: string): RefreshTokenPayload {
  return jwt.verify(token, env.jwtRefreshSecret) as RefreshTokenPayload;
}
