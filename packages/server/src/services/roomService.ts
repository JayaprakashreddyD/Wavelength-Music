import { RoomRole, RoomVisibility } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { ConflictError, ForbiddenError, NotFoundError } from "@/utils/errors";

const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars (0/O, 1/I)

function generateCode(length = 6): string {
  let code = "";
  for (let i = 0; i < length; i++) {
    code += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return code;
}

async function generateUniqueRoomCode(): Promise<string> {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = generateCode();
    const clash = await prisma.room.findUnique({ where: { code } });
    if (!clash) return code;
  }
  throw new ConflictError("Could not generate a unique room code, please retry");
}

export async function createRoom(
  hostId: string,
  input: { name: string; description?: string; visibility: RoomVisibility; artworkUrl?: string }
) {
  const code = input.visibility === "PRIVATE" ? await generateUniqueRoomCode() : null;

  const room = await prisma.room.create({
    data: {
      name: input.name,
      description: input.description,
      artworkUrl: input.artworkUrl,
      visibility: input.visibility,
      code,
      hostId,
      members: { create: { userId: hostId, role: RoomRole.HOST } },
      playbackState: {
        create: { state: "STOPPED", position: 0, serverTimestamp: BigInt(Date.now()), queueVersion: 0 },
      },
    },
    include: { members: true, playbackState: true },
  });

  return room;
}

export async function listPublicRooms() {
  const rooms = await prisma.room.findMany({
    where: { visibility: "PUBLIC", closedAt: null },
    include: {
      host: { select: { id: true, username: true, profileImage: true } },
      members: { where: { isConnected: true } },
      playbackState: true,
    },
    orderBy: { updatedAt: "desc" },
  });

  // Attach current song title/artist for the room card preview.
  const withSong = await Promise.all(
    rooms.map(async (room) => {
      const songId = room.playbackState?.currentSongId;
      const song = songId ? await prisma.song.findUnique({ where: { id: songId } }) : null;
      return {
        id: room.id,
        name: room.name,
        description: room.description,
        artworkUrl: room.artworkUrl,
        host: room.host,
        memberCount: room.members.length,
        currentSong: song
          ? { id: song.id, title: song.title, artist: song.artistName, artworkUrl: song.artworkUrl }
          : null,
        playbackState: room.playbackState?.state ?? "STOPPED",
      };
    })
  );

  return withSong; } export async function listMyRooms(userId: string) { const memberships = await prisma.roomMember.findMany({ where: { userId, room: { closedAt: null } }, include: { room: { include: { host: { select: { id: true, username: true, profileImage: true } }, members: { where: { isConnected: true } }, }, }, }, orderBy: { joinedAt: "desc" }, }); return Promise.all( memberships.map(async (m) => { const room = m.room; const playbackState = await prisma.roomPlaybackState.findUnique({ where: { roomId: room.id } }); const songId = playbackState?.currentSongId; const song = songId ? await prisma.song.findUnique({ where: { id: songId } }) : null; return { id: room.id, name: room.name, description: room.description, artworkUrl: room.artworkUrl, visibility: room.visibility, code: room.visibility === "PRIVATE" ? room.code ?? undefined : undefined, host: room.host, memberCount: room.members.length, currentSong: song ? { id: song.id, title: song.title, artist: song.artistName, artworkUrl: song.artworkUrl } : null, playbackState: playbackState?.state ?? "STOPPED", }; }) ); } export async function getRoomOrThrow(roomId: string) {
  const room = await prisma.room.findUnique({ where: { id: roomId } });
  if (!room || room.closedAt) throw new NotFoundError("Room not found");
  return room;
}

export async function getRoomDetail(roomId: string) {
  const room = await prisma.room.findUnique({
    where: { id: roomId },
    include: {
      host: { select: { id: true, username: true, profileImage: true } },
      members: { include: { user: { select: { id: true, username: true, profileImage: true } } } },
      playbackState: true,
    },
  });
  if (!room || room.closedAt) throw new NotFoundError("Room not found");
  return room;
}

export async function joinPublicRoom(roomId: string, userId: string) { const room = await getRoomOrThrow(roomId); const existing = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } }); if (!existing && room.visibility !== "PUBLIC") { throw new ForbiddenError("This room is private"); } return joinRoomInternal(room.id, userId); }

export async function joinPrivateRoomByCode(code: string, userId: string) {
  const room = await prisma.room.findUnique({ where: { code } });
  if (!room || room.closedAt) throw new NotFoundError("Invalid room code");
  return joinRoomInternal(room.id, userId);
}

async function joinRoomInternal(roomId: string, userId: string) {
  const existing = await prisma.roomMember.findUnique({
    where: { roomId_userId: { roomId, userId } },
  });

  if (existing) {
    // Reconnecting member: keep their existing role, just mark connected.
    return prisma.roomMember.update({
      where: { id: existing.id },
      data: { isConnected: true, leftAt: null },
    });
  }

  return prisma.roomMember.create({
    data: { roomId, userId, role: RoomRole.MEMBER },
  });
}

export async function setMemberConnection(roomId: string, userId: string, isConnected: boolean) {
  await prisma.roomMember.updateMany({
    where: { roomId, userId },
    data: { isConnected, leftAt: isConnected ? null : new Date() },
  });
}

export async function getMemberRole(roomId: string, userId: string): Promise<RoomRole | null> {
  const member = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId } } });
  return member?.role ?? null;
}

export async function requireHost(roomId: string, userId: string) {
  const room = await getRoomOrThrow(roomId);
  if (room.hostId !== userId) throw new ForbiddenError("Only the host can do this");
  return room;
}

export async function promoteToElder(roomId: string, actingUserId: string, targetUserId: string) {
  await requireHost(roomId, actingUserId);
  const target = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: targetUserId } } });
  if (!target) throw new NotFoundError("Member not found in this room");
  if (target.role === RoomRole.HOST) throw new ForbiddenError("Cannot change the host's role");

  return prisma.roomMember.update({
    where: { id: target.id },
    data: { role: RoomRole.ELDER },
  });
}

export async function demoteToMember(roomId: string, actingUserId: string, targetUserId: string) {
  await requireHost(roomId, actingUserId);
  const target = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: targetUserId } } });
  if (!target) throw new NotFoundError("Member not found in this room");
  if (target.role === RoomRole.HOST) throw new ForbiddenError("Cannot change the host's role");

  return prisma.roomMember.update({
    where: { id: target.id },
    data: { role: RoomRole.MEMBER },
  });
}

export async function removeMember(roomId: string, actingUserId: string, targetUserId: string) {
  await requireHost(roomId, actingUserId);
  if (targetUserId === actingUserId) throw new ForbiddenError("Host cannot remove themselves — use End Room");

  const target = await prisma.roomMember.findUnique({ where: { roomId_userId: { roomId, userId: targetUserId } } });
  if (!target) throw new NotFoundError("Member not found in this room");

  await prisma.roomMember.delete({ where: { id: target.id } });
}

export async function leaveRoom(roomId: string, userId: string) {
  const room = await getRoomOrThrow(roomId);

  if (room.hostId === userId) {
    return migrateHost(roomId);
  }

  await prisma.roomMember.deleteMany({ where: { roomId, userId } });
  return null;
}

// Deterministic host migration: prefer the longest-tenured connected Elder,
// falling back to the longest-tenured connected Member. If nobody is left,
// the room is closed.
export async function migrateHost(roomId: string) {
  const candidates = await prisma.roomMember.findMany({
    where: { roomId, isConnected: true, role: { in: [RoomRole.ELDER, RoomRole.MEMBER] } },
    orderBy: [{ role: "asc" }, { joinedAt: "asc" }], // enum declared as HOST, ELDER, MEMBER — asc puts ELDER before MEMBER
  });

  const oldHostMembership = await prisma.roomMember.findFirst({
    where: { roomId, role: RoomRole.HOST },
  });

  if (candidates.length === 0) {
    await closeRoom(roomId);
    return { newHostId: null, closed: true };
  }

  const next = candidates[0];

  await prisma.$transaction([
    prisma.room.update({ where: { id: roomId }, data: { hostId: next.userId } }),
    prisma.roomMember.update({ where: { id: next.id }, data: { role: RoomRole.HOST } }),
    ...(oldHostMembership
      ? [prisma.roomMember.delete({ where: { id: oldHostMembership.id } })]
      : []),
  ]);

  return { newHostId: next.userId, closed: false };
}

export async function closeRoom(roomId: string) {
  await prisma.room.update({ where: { id: roomId }, data: { closedAt: new Date() } });
}

export async function endRoom(roomId: string, actingUserId: string) {
  await requireHost(roomId, actingUserId);
  await closeRoom(roomId);
}
