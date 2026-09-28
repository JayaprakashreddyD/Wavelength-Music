import rateLimit, { type ClientRateLimitInfo, type Store } from "express-rate-limit";
import { redis } from "@/redis/client";

class RedisRateLimitStore implements Store {
  readonly localKeys = false;
  private windowMs = 60_000;

  constructor(readonly prefix: string) {}

  init(options: Parameters<NonNullable<Store["init"]>>[0]) {
    this.windowMs = options.windowMs;
  }

  private key(key: string) {
    return `rate-limit:${this.prefix}:${key}`;
  }

  async get(key: string): Promise<ClientRateLimitInfo | undefined> {
    const result = await redis.multi().get(this.key(key)).pttl(this.key(key)).exec();
    const count = Number(result?.[0]?.[1] ?? 0);
    const ttl = Number(result?.[1]?.[1] ?? -1);
    if (!count || ttl < 0) return undefined;
    return { totalHits: count, resetTime: new Date(Date.now() + ttl) };
  }

  async increment(key: string): Promise<ClientRateLimitInfo> {
    const lua = `
      local hits = redis.call('INCR', KEYS[1])
      if hits == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end
      return { hits, redis.call('PTTL', KEYS[1]) }
    `;
    const result = await redis.eval(lua, 1, this.key(key), String(this.windowMs)) as [number, number];
    return { totalHits: Number(result[0]), resetTime: new Date(Date.now() + Number(result[1])) };
  }

  async decrement(key: string): Promise<void> {
    const redisKey = this.key(key);
    const count = await redis.decr(redisKey);
    if (count <= 0) await redis.del(redisKey);
  }

  async resetKey(key: string): Promise<void> {
    await redis.del(this.key(key));
  }
}

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore("api"),
});

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore("auth"),
  message: { success: false, error: { code: "RATE_LIMITED", message: "Too many attempts, try again later." } },
});

export const uploadLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 30,
  standardHeaders: true,
  legacyHeaders: false,
  store: new RedisRateLimitStore("upload"),
});
