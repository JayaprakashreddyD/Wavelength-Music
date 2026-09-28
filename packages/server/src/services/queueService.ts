import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { NotFoundError } from "@/utils/errors";
import { bumpQueueVersion } from "@/services/playbackService";

type TxClient = Prisma.TransactionClient;

export async function getQueue(roomId: string) {
  return prisma.roomQueueSong.findMany({
    where: { roomId },
    orderBy: { position: "asc" },
    include: { song: true },
  });
}

// Adds one or more songs to a room's queue, skipping any that are already
// present. The (roomId, songId) unique constraint in the schema is the
// real guarantee against duplicates — this function additionally
// pre-filters so we can report an accurate "N added, M duplicates skipped"
// count, and so a burst of adds doesn't rely on catching unique-constraint
// errors as the normal path.
export async function addSongsToQueue(roomId: string, addedById: string, songIds: string[]) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.roomQueueSong.findMany({
      where: { roomId, songId: { in: songIds } },
      select: { songId: true },
    });
    const existingIds = new Set(existing.map((e) => e.songId));

    // De-dupe the incoming list itself too, preserving first occurrence order.
    const seen = new Set<string>();
    const toAdd = songIds.filter((id) => {
      if (existingIds.has(id) || seen.has(id)) return false;
      seen.add(id);
      return true;
    });

    if (toAdd.length === 0) {
      return { added: 0, duplicatesSkipped: songIds.length, queue: await getQueueTx(tx, roomId) };
    }

    const currentMax = await tx.roomQueueSong.count({ where: { roomId } });

    await tx.roomQueueSong.createMany({
      data: toAdd.map((songId, index) => ({
        roomId,
        songId,
        addedById,
        position: currentMax + index,
      })),
      skipDuplicates: true, // final safety net against race conditions
    });

    await bumpQueueVersion(roomId, tx);

    return {
      added: toAdd.length,
      duplicatesSkipped: songIds.length - toAdd.length,
      queue: await getQueueTx(tx, roomId),
    };
  });
}

// Adds every song in a playlist to the room queue, preserving playlist
// order among the newly-added songs, skipping anything already queued.
export async function addPlaylistToQueue(roomId: string, addedById: string, playlistId: string) {
  const playlist = await prisma.playlist.findUnique({
    where: { id: playlistId },
    include: { songs: { orderBy: { position: "asc" }, select: { songId: true } } },
  });
  if (!playlist) throw new NotFoundError("Playlist not found");

  const orderedSongIds = playlist.songs.map((s) => s.songId);
  return addSongsToQueue(roomId, addedById, orderedSongIds);
}

export async function removeSongFromQueue(roomId: string, songId: string) {
  await prisma.$transaction(async (tx) => {
    await tx.roomQueueSong.deleteMany({ where: { roomId, songId } });
    await resequence(tx, roomId);
    await bumpQueueVersion(roomId, tx);
  });
  return getQueue(roomId);
}

export async function reorderQueue(roomId: string, orderedSongIds: string[]) {
  await prisma.$transaction(async (tx) => {
    for (let index = 0; index < orderedSongIds.length; index++) {
      await tx.roomQueueSong.updateMany({
        where: { roomId, songId: orderedSongIds[index] },
        data: { position: index },
      });
    }
    await bumpQueueVersion(roomId, tx);
  });
  return getQueue(roomId);
}

async function getQueueTx(tx: TxClient, roomId: string) {
  return tx.roomQueueSong.findMany({
    where: { roomId },
    orderBy: { position: "asc" },
    include: { song: true },
  });
}

async function resequence(tx: TxClient, roomId: string) {
  const entries = await tx.roomQueueSong.findMany({ where: { roomId }, orderBy: { position: "asc" } });
  for (let index = 0; index < entries.length; index++) {
    await tx.roomQueueSong.update({ where: { id: entries[index].id }, data: { position: index } });
  }
}

// The room queue only ever represents "up next" — the currently playing
// song is tracked solely on RoomPlaybackState.currentSongId and is removed
// from this table the moment it starts playing (see playbackService's
// changeSong). So "what plays next" is always simply the front of the
// queue, with no position bookkeeping relative to whatever just finished.
export async function peekNext(roomId: string) {
  const [next] = await prisma.roomQueueSong.findMany({
    where: { roomId },
    orderBy: { position: "asc" },
    take: 1,
    include: { song: true },
  });
  return next ?? null;
}

export async function isSongInQueue(roomId: string, songId: string): Promise<boolean> {
  const entry = await prisma.roomQueueSong.findUnique({ where: { roomId_songId: { roomId, songId } } });
  return !!entry;
}
