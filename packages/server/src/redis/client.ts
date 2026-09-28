import Redis from "ioredis";
import { env } from "@/config/env";

// Two connections are needed for Socket.IO's Redis adapter (pub/sub);
// `redis` is reused for general caching (e.g. room state read-through cache).
export const redis = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
export const redisPub = new Redis(env.redisUrl, { maxRetriesPerRequest: null });
export const redisSub = redisPub.duplicate();

redis.on("error", (err) => console.error("[redis] connection error", {
  name: err.name,
  code: (err as NodeJS.ErrnoException).code,
}));
