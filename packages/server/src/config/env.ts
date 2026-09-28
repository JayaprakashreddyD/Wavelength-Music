import dotenv from "dotenv";

dotenv.config();

function optional(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value || undefined;
}

function required(name: string, fallback?: string): string {
  const value = optional(name) ?? fallback;
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function positiveInteger(name: string, fallback: number): number {
  const raw = optional(name);
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return value;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProd = nodeEnv === "production";
const originsValue = optional("CORS_ORIGIN") ?? optional("CLIENT_ORIGIN") ?? "http://localhost:3000";
const corsOrigins = [...new Set(originsValue.split(",").map((origin) => origin.trim()).filter(Boolean))];
const accessTtl = optional("JWT_ACCESS_TTL") ?? "15m";
const refreshTtl = optional("JWT_REFRESH_TTL") ?? "30d";
const cookieSameSite = (optional("COOKIE_SAME_SITE") ?? "lax").toLowerCase();

if (!corsOrigins.length || corsOrigins.some((origin) => origin === "*")) {
  throw new Error("CORS_ORIGIN must contain one or more explicit origins; wildcard origins are not allowed");
}
if (!["lax", "strict", "none"].includes(cookieSameSite)) {
  throw new Error("COOKIE_SAME_SITE must be lax, strict, or none");
}
if (isProd && cookieSameSite === "none" && process.env.COOKIE_SECURE !== "true") {
  throw new Error("COOKIE_SECURE=true is required with COOKIE_SAME_SITE=none in production");
}

const jwtAccessSecret = required("JWT_ACCESS_SECRET");
const jwtRefreshSecret = required("JWT_REFRESH_SECRET");
if (isProd) {
  for (const [name, secret] of [["JWT_ACCESS_SECRET", jwtAccessSecret], ["JWT_REFRESH_SECRET", jwtRefreshSecret]] as const) {
    if (secret.length < 32 || secret.startsWith("change_me")) {
      throw new Error(`${name} must be a unique secret of at least 32 characters in production`);
    }
  }
}

const trustProxyValue = optional("TRUST_PROXY") ?? (isProd ? "1" : "0");
const trustProxy = trustProxyValue === "true" ? 1 : trustProxyValue === "false" ? false : Number(trustProxyValue);
if (trustProxy !== false && (!Number.isSafeInteger(trustProxy) || trustProxy < 0)) {
  throw new Error("TRUST_PROXY must be true, false, or a non-negative integer hop count");
}

function ttlToMilliseconds(value: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/i.exec(value);
  if (!match) throw new Error("JWT TTL values must use ms, s, m, h, or d units (for example 15m or 30d)");
  const amount = Number(match[1]);
  const unit = match[2].toLowerCase();
  return amount * ({ ms: 1, s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }[unit] ?? 0);
}

const publicStorageUrl = required("S3_PUBLIC_URL", optional("S3_PUBLIC_BASE_URL"));
const storageEndpoint = required("S3_ENDPOINT");
const redisUrl = required("REDIS_URL", isProd ? undefined : "redis://localhost:6379");
const webAppUrl = required("WEB_APP_URL", isProd ? undefined : "http://localhost:3000").replace(/\/$/, "");
let parsedWebAppUrl: URL;
try {
  parsedWebAppUrl = new URL(webAppUrl);
} catch {
  throw new Error("WEB_APP_URL must be an absolute HTTP(S) URL");
}
if (!["http:", "https:"].includes(parsedWebAppUrl.protocol) || (isProd && parsedWebAppUrl.protocol !== "https:")) {
  throw new Error("WEB_APP_URL must use HTTPS in production");
}
if (isProd) {
  for (const origin of corsOrigins) {
    let parsedOrigin: URL;
    try { parsedOrigin = new URL(origin); } catch { throw new Error("CORS_ORIGIN entries must be valid HTTPS origins in production"); }
    if (parsedOrigin.protocol !== "https:" || parsedOrigin.origin !== origin) {
      throw new Error("CORS_ORIGIN entries must be exact HTTPS origins in production");
    }
  }
  if (parsedWebAppUrl.origin !== webAppUrl) throw new Error("WEB_APP_URL must be an origin without a path in production");
  if (!redisUrl.startsWith("rediss://")) throw new Error("REDIS_URL must use TLS (rediss://) in production");
  try {
    if (new URL(storageEndpoint).protocol !== "https:" || new URL(publicStorageUrl).protocol !== "https:") throw new Error();
  } catch {
    throw new Error("S3_ENDPOINT and S3_PUBLIC_URL must use HTTPS in production");
  }
  if (jwtAccessSecret === jwtRefreshSecret) throw new Error("JWT_ACCESS_SECRET and JWT_REFRESH_SECRET must be different");
}

export const env = {
  port: positiveInteger("PORT", 4000),
  nodeEnv,
  isProd,
  trustProxy,
  corsOrigins,
  clientOrigin: corsOrigins[0], // Backward-compatible alias for integrations expecting one origin.
  cookie: {
    domain: optional("COOKIE_DOMAIN"),
    path: optional("COOKIE_PATH") ?? "/",
    sameSite: cookieSameSite as "lax" | "strict" | "none",
    secure: isProd || optional("COOKIE_SECURE") === "true",
  },

  databaseUrl: required("DATABASE_URL"),
  redisUrl,

  jwtAccessSecret,
  jwtRefreshSecret,
  jwtAccessTtl: accessTtl,
  jwtRefreshTtl: refreshTtl,
  jwtAccessMaxAgeMs: ttlToMilliseconds(accessTtl),
  jwtRefreshMaxAgeMs: ttlToMilliseconds(refreshTtl),

  s3: {
    endpoint: storageEndpoint,
    region: optional("S3_REGION") ?? "us-east-1",
    accessKeyId: required("S3_ACCESS_KEY_ID"),
    secretAccessKey: required("S3_SECRET_ACCESS_KEY"),
    bucket: required("S3_BUCKET"),
    forcePathStyle: optional("S3_FORCE_PATH_STYLE") === undefined
      ? !isProd
      : optional("S3_FORCE_PATH_STYLE") === "true",
    publicBaseUrl: publicStorageUrl.replace(/\/$/, ""),
  },

  maxAudioFileSizeBytes: positiveInteger("MAX_AUDIO_FILE_SIZE_MB", 50) * 1024 * 1024,
  maxArtworkFileSizeBytes: positiveInteger("MAX_ARTWORK_FILE_SIZE_MB", 5) * 1024 * 1024,
  google: { clientId: required("GOOGLE_CLIENT_ID") },
  webAppUrl,
  email: {
    user: required("EMAIL_USER"),
    appPassword: required("EMAIL_APP_PASSWORD"),
  },
};
