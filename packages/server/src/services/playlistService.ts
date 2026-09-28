import { prisma } from "@/db/prisma";
import { ForbiddenError, NotFoundError } from "@/utils/errors";

export async function createPlaylist(ownerId: string, input: { name: string; description?: string }) {
  return prisma.playlist.create({ data: { ownerId, name: input.name, description: input.description } });
}

export async function getUserPlaylists(ownerId: string) {
  return prisma.playlist.findMany({
    where: { ownerId },
    orderBy: { updatedAt: "desc" },
    include: { songs: { select: { songId: true } } },
  });
}

async function getOwnedPlaylistOrThrow(playlistId: string, ownerId: string) {
  const playlist = await prisma.playlist.findUnique({ where: { id: playlistId } });
  if (!playlist) throw new NotFoundError("Playlist not found");
  if (playlist.ownerId !== ownerId) throw new ForbiddenError("You don't own this playlist");
  return playlist;
}

export async function getPlaylistWithSongs(playlistId: string) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: { songs: { orderBy: { position: "asc" }, include: { song: true } } },
  });
  if (!playlist) throw new NotFoundError("Playlist not found");
  return playlist;
}

export async function renamePlaylist(
  playlistId: string,
  ownerId: string,
  input: { name?: string; description?: string }
) {
  await getOwnedPlaylistOrThrow(playlistId, ownerId);
  return prisma.playlist.update({ where: { id: playlistId }, data: input });
}

export async function deletePlaylist(playlistId: string, ownerId: string) {
  await getOwnedPlaylistOrThrow(playlistId, ownerId);
  await prisma.playlist.delete({ where: { id: playlistId } });
}

export async function addSongToPlaylist(playlistId: string, ownerId: string, songId: string) {
  await getOwnedPlaylistOrThrow(playlistId, ownerId);

  const existing = await prisma.playlistSong.findUnique({
    where: { playlistId_songId: { playlistId, songId } },
  });
  if (existing) return existing; // idempotent add

  const count = await prisma.playlistSong.count({ where: { playlistId } });
  const entry = await prisma.playlistSong.create({
    data: { playlistId, songId, position: count },
  });
  await prisma.playlist.update({ where: { id: playlistId }, data: { updatedAt: new Date() } });
  return entry;
}

export async function removeSongFromPlaylist(playlistId: string, ownerId: string, songId: string) {
  await getOwnedPlaylistOrThrow(playlistId, ownerId);
  await prisma.playlistSong.deleteMany({ where: { playlistId, songId } });
  await resequence(playlistId);
}

export async function reorderPlaylist(playlistId: string, ownerId: string, orderedSongIds: string[]) {
  await getOwnedPlaylistOrThrow(playlistId, ownerId);
  await prisma.$transaction(
    orderedSongIds.map((songId, index) =>
      prisma.playlistSong.updateMany({
        where: { playlistId, songId },
        data: { position: index },
      })
    )
  );
}

async function resequence(playlistId: string) {
  const entries = await prisma.playlistSong.findMany({
    where: { playlistId },
    orderBy: { position: "asc" },
  });
  await prisma.$transaction(
    entries.map((entry, index) =>
      prisma.playlistSong.update({ where: { id: entry.id }, data: { position: index } })
    )
  );
}
