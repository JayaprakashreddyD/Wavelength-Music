import { Server as HttpServer } from "http";
import { Server } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { redisPub, redisSub } from "@/redis/client";
import { prisma } from "@/db/prisma";
import { verifyAccessToken } from "@/auth/jwt";
import { env } from "@/config/env";
import { logger } from "@/utils/logger";
import { registerRoomHandlers } from "@/sockets/roomSocket";
import { rehydrateTimersForActiveRooms } from "@/services/playbackService";
import { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/sockets/types";

export function createSocketServer(httpServer: HttpServer) {
  const io = new Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>(httpServer, {
    cors: { origin: env.corsOrigins, credentials: true },
    adapter: createAdapter(redisPub, redisSub),
  });

  // Every connection must present a valid access token — either as a
  // cookie (browser clients) or an `auth.token` handshake field. Sockets
  // never trust a userId supplied by the client payload itself.
  io.use((socket, next) => {
    void (async () => {
      try {
      const cookieHeader = socket.handshake.headers.cookie ?? "";
      const cookieToken = parseCookie(cookieHeader, "access_token");
      const handshakeToken = socket.handshake.auth?.token as string | undefined;
      const token = handshakeToken ?? cookieToken;

      if (!token) return next(new Error("Unauthorized"));

      const payload = verifyAccessToken(token);
      const user = await prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, tokenVersion: true },
      });
      if (!user || (payload.tokenVersion ?? 0) !== user.tokenVersion) {
        return next(new Error("Unauthorized"));
      }
      socket.data.userId = payload.sub;
      socket.data.username = payload.username;
      next();
      } catch {
        next(new Error("Unauthorized"));
      }
    })();
  });

  registerRoomHandlers(io);
  rehydrateTimersForActiveRooms().catch((err) => logger.error("Failed to rehydrate playback timers", err));

  return io;
}

function parseCookie(cookieHeader: string, name: string): string | undefined {
  const match = cookieHeader.split(";").map((c) => c.trim()).find((c) => c.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=").slice(1).join("=")) : undefined;
}
