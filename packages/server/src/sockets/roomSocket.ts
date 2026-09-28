import { Server, Socket } from "socket.io";
import { prisma } from "@/db/prisma";
import { logger } from "@/utils/logger";
import { can } from "@/sockets/permissions";
import * as roomService from "@/services/roomService";
import * as queueService from "@/services/queueService";
import * as playbackService from "@/services/playbackService";
import { ClientToServerEvents, ServerToClientEvents, SocketData } from "@/sockets/types";

type AppSocket = Socket<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;
type AppServer = Server<ClientToServerEvents, ServerToClientEvents, Record<string, never>, SocketData>;

const roomChannel = (roomId: string) => `room:${roomId}`;

function safeQueue<T extends { song: { audioStorageKey?: unknown; artworkStorageKey?: unknown } }>(items: T[]) {
  return items.map(({ song, ...entry }) => {
    const { audioStorageKey: _audioKey, artworkStorageKey: _artworkKey, ...publicSong } = song;
    return { ...entry, song: publicSong };
  });
}

// Grace period before a disconnected member is treated as having left for
// good (host migration, "member left" broadcast). Lets a flaky connection
// or a page refresh reconnect without losing role or disrupting the room.
const DISCONNECT_GRACE_MS = 20_000;
const pendingDisconnects = new Map<string, NodeJS.Timeout>(); // key: `${roomId}:${userId}`

async function buildStatePayload(roomId: string) {
  const [snapshot, room] = await Promise.all([
    playbackService.getPlaybackState(roomId),
    roomService.getRoomDetail(roomId),
  ]);
  return {
    playback: snapshot,
    // Server sends the authoritative "now" alongside the snapshot so
    // clients can compute (now - serverTimestamp) without trusting their
    // own clock's absolute value — only its rate, which is what elapsed-
    // time math actually depends on.
    serverNow: Date.now(),
    room: {
      id: room.id,
      name: room.name,
      visibility: room.visibility,
      hostId: room.hostId,
      members: room.members.map((m) => ({
        userId: m.userId,
        username: m.user.username,
        profileImage: m.user.profileImage,
        role: m.role,
        isConnected: m.isConnected,
      })),
    },
  };
}

async function broadcastState(io: AppServer, roomId: string) {
  const payload = await buildStatePayload(roomId);
  io.to(roomChannel(roomId)).emit("room:state", payload);
}

async function broadcastQueue(io: AppServer, roomId: string) {
  const [queue, snapshot] = await Promise.all([
    queueService.getQueue(roomId),
    playbackService.getPlaybackState(roomId),
  ]);
  io.to(roomChannel(roomId)).emit("room:queue-update", { queue: safeQueue(queue), queueVersion: snapshot.queueVersion });
}

async function getRole(roomId: string, userId: string) {
  return roomService.getMemberRole(roomId, userId);
}

function fail(socket: AppSocket, code: string, message: string) {
  socket.emit("error", { code, message });
}

export function registerRoomHandlers(io: AppServer) {
  // Broadcast a lightweight sync tick to every playing room every few
  // seconds. Clients use this to measure and correct drift per the
  // algorithm in section 14 (small drift -> gradual rate correction,
  // large drift -> hard seek), rather than re-deriving position only on
  // discrete events.
  setInterval(async () => {
    const playingRooms = await prisma.roomPlaybackState.findMany({ where: { state: "PLAYING" } });
    for (const row of playingRooms) {
      io.to(roomChannel(row.roomId)).emit("room:sync", {
        roomId: row.roomId,
        currentSongId: row.currentSongId,
        state: row.state,
        position: row.position,
        serverTimestamp: Number(row.serverTimestamp),
        serverNow: Date.now(),
        queueVersion: row.queueVersion,
      });
    }
  }, 4000);

  playbackService.playbackEvents.on("song-changed", async (snapshot) => {
    await broadcastState(io, snapshot.roomId);
  });
  playbackService.playbackEvents.on("state-changed", async (snapshot) => {
    await broadcastState(io, snapshot.roomId);
  });
  playbackService.playbackEvents.on("song-ended", async ({ roomId }) => {
    await broadcastState(io, roomId);
    await broadcastQueue(io, roomId);
  });

  io.on("connection", (socket: AppSocket) => {
    const { userId, username } = socket.data;
    logger.info("socket connected", { userId, username, socketId: socket.id });

    socket.on("room:join", async ({ roomId }, ack) => {
      try {
        const key = `${roomId}:${userId}`;
        const pending = pendingDisconnects.get(key);
        if (pending) {
          clearTimeout(pending);
          pendingDisconnects.delete(key);
        }

        await roomService.getRoomOrThrow(roomId);
        // Membership itself is created by the REST join / join-by-code
        // endpoint before the client opens the socket; a missing
        // membership here means the client skipped that step.
        const existingRole = await getRole(roomId, userId);
        if (!existingRole) {
          return ack({ ok: false, error: "Join the room via the API before connecting" });
        }
        await roomService.setMemberConnection(roomId, userId, true);

        socket.join(roomChannel(roomId));
        const role = await getRole(roomId, userId);

        const payload = await buildStatePayload(roomId);
        const queue = await queueService.getQueue(roomId);

        // New joiner receives current state + queue immediately, and their
        // player will start at the server's computed position (see
        // playbackService.computeCurrentPosition), not at 00:00.
        socket.emit("room:state", payload);
        socket.emit("room:queue-update", { queue: safeQueue(queue), queueVersion: payload.playback.queueVersion });

        socket.to(roomChannel(roomId)).emit("room:member-join", { userId, username, role });

        ack({ ok: true, role: role ?? undefined });
      } catch (err) {
        logger.error("room:join failed", err);
        ack({ ok: false, error: "Failed to join room" });
      }
    });

    socket.on("room:leave", async ({ roomId }) => {
      socket.leave(roomChannel(roomId));
      await handleMemberLeaving(io, roomId, userId);
    });

    socket.on("room:play", async ({ roomId }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "PLAY_PAUSE")) return fail(socket, "FORBIDDEN", "You can't control playback in this room");
      await playbackService.playPause(roomId, "play");
    });

    socket.on("room:pause", async ({ roomId }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "PLAY_PAUSE")) return fail(socket, "FORBIDDEN", "You can't control playback in this room");
      await playbackService.playPause(roomId, "pause");
    });

    socket.on("room:seek", async ({ roomId, position }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "SEEK")) return fail(socket, "FORBIDDEN", "You can't seek in this room");
      await playbackService.seek(roomId, position);
    });

    socket.on("room:song-change", async ({ roomId, songId, autoplay }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "CHANGE_SONG")) return fail(socket, "FORBIDDEN", "You can't change songs in this room");
      await playbackService.changeSong(roomId, songId, { autoplay: autoplay ?? true });
    });

    socket.on("room:queue-add-songs", async ({ roomId, songIds }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "ADD_SONGS")) return fail(socket, "FORBIDDEN", "You can't add songs in this room");
      const result = await queueService.addSongsToQueue(roomId, userId, songIds);
      await broadcastQueue(io, roomId);
      socket.emit("room:queue-update", {
        queue: safeQueue(result.queue),
        added: result.added,
        duplicatesSkipped: result.duplicatesSkipped,
      });
    });

    socket.on("room:queue-add-playlist", async ({ roomId, playlistId }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "ADD_PLAYLIST")) return fail(socket, "FORBIDDEN", "You can't add playlists in this room");
      const result = await queueService.addPlaylistToQueue(roomId, userId, playlistId);
      await broadcastQueue(io, roomId);
      socket.emit("room:queue-update", {
        queue: safeQueue(result.queue),
        added: result.added,
        duplicatesSkipped: result.duplicatesSkipped,
      });
    });

    socket.on("room:queue-remove", async ({ roomId, songId }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "REMOVE_SONG")) return fail(socket, "FORBIDDEN", "You can't remove songs in this room");
      await queueService.removeSongFromQueue(roomId, songId);
      await broadcastQueue(io, roomId);
    });

    socket.on("room:queue-reorder", async ({ roomId, orderedSongIds }) => {
      const role = await getRole(roomId, userId);
      if (!can(role, "REORDER_QUEUE")) return fail(socket, "FORBIDDEN", "You can't reorder the queue in this room");
      await queueService.reorderQueue(roomId, orderedSongIds);
      await broadcastQueue(io, roomId);
    });

    socket.on("room:role-change", async ({ roomId, targetUserId, action }) => {
      try {
        if (action === "promote") await roomService.promoteToElder(roomId, userId, targetUserId);
        if (action === "demote") await roomService.demoteToMember(roomId, userId, targetUserId);
        if (action === "remove") {
          await roomService.removeMember(roomId, userId, targetUserId);
          io.to(roomChannel(roomId)).emit("room:member-leave", { userId: targetUserId, reason: "removed" });
        }
        await broadcastState(io, roomId);
      } catch (err: any) {
        fail(socket, err.code ?? "FORBIDDEN", err.message ?? "Role change failed");
      }
    });

    socket.on("room:sync-request", async ({ roomId }) => {
      const snapshot = await playbackService.getPlaybackState(roomId);
      socket.emit("room:sync", { ...snapshot, serverNow: Date.now() });
    });

    socket.on("disconnect", async () => {
      logger.info("socket disconnected", { userId, socketId: socket.id });
      for (const room of socket.rooms) {
        if (!room.startsWith("room:")) continue;
        const roomId = room.slice("room:".length);
        scheduleDisconnectHandling(io, roomId, userId);
      }
    });
  });
}

function scheduleDisconnectHandling(io: AppServer, roomId: string, userId: string) {
  const key = `${roomId}:${userId}`;
  const existing = pendingDisconnects.get(key);
  if (existing) clearTimeout(existing);

  const timer = setTimeout(async () => {
    pendingDisconnects.delete(key);
    await handleMemberLeaving(io, roomId, userId, { permanent: true });
  }, DISCONNECT_GRACE_MS);

  pendingDisconnects.set(key, timer);
  // Optimistically mark disconnected right away so hosts/elders can see it,
  // even though we wait DISCONNECT_GRACE_MS before treating it as final.
  roomService.setMemberConnection(roomId, userId, false).catch(() => {});
}

async function handleMemberLeaving(
  io: AppServer,
  roomId: string,
  userId: string,
  opts: { permanent?: boolean } = {}
) {
  try {
    const room = await roomService.getRoomOrThrow(roomId).catch(() => null);
    if (!room) return;

    if (opts.permanent) {
      const wasHost = room.hostId === userId;
      const result = await roomService.leaveRoom(roomId, userId);

      if (wasHost && result) {
        if (result.closed) {
          io.to(roomChannel(roomId)).emit("room:closed", { roomId });
          return;
        }
        if (result.newHostId) {
          io.to(roomChannel(roomId)).emit("room:host-migrated", { roomId, newHostId: result.newHostId });
        }
      }
    }

    io.to(roomChannel(roomId)).emit("room:member-leave", { userId, permanent: !!opts.permanent });
    await broadcastState(io, roomId);
  } catch (err) {
    logger.error("handleMemberLeaving failed", err);
  }
}
