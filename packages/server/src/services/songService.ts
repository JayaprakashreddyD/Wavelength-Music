import { Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { AppError, ForbiddenError, NotFoundError } from "@/utils/errors";
import { deleteObject, getStorageKeyFromUrl } from "@/storage/s3";

export interface CreateSongInput {
  title: string;
  artist: string;
  album?: string;
  genre?: string;
  uploadedById: string;
  audioUrl: string;
  audioStorageKey: string;
  artworkUrl?: string;
  artworkStorageKey?: string;
  duration: number;
}

async function findOrCreateArtist(name: string) {
  return prisma.artist.upsert({ where: { name }, update: {}, create: { name } });
}

async function findOrCreateAlbum(title: string, artistId: string) {
  const existing = await prisma.album.findFirst({ where: { title, artistId } });
  if (existing) return existing;
  return prisma.album.create({ data: { title, artistId } });
}

export async function createSong(input: CreateSongInput) {
  const artist = await findOrCreateArtist(input.artist);
  const album = input.album ? await findOrCreateAlbum(input.album, artist.id) : null;

  return prisma.song.create({
    data: {
      title: input.title,
      artistName: input.artist,
      artistId: artist.id,
      albumName: input.album,
      albumId: album?.id,
      genre: input.genre,
      uploadedById: input.uploadedById,
      audioUrl: input.audioUrl,
      audioStorageKey: input.audioStorageKey,
      artworkUrl: input.artworkUrl,
      artworkStorageKey: input.artworkStorageKey,
      duration: input.duration,
    },
  });
}

export interface ListSongsParams {
   mine?: boolean;
  q?: string;
  artist?: string;
  album?: string;
  genre?: string;
  sort: "recent" | "popular" | "recentlyPlayed" | "alphabetical";
  page: number;
  pageSize: number;
  userId?: string; // used for "recentlyPlayed" personalization
}

export async function listSongs(params: ListSongsParams) {
  const where: Prisma.SongWhereInput = {
    AND: [
      params.q
        ? {
            OR: [
              { title: { contains: params.q, mode: "insensitive" } },
              { artistName: { contains: params.q, mode: "insensitive" } },
              { albumName: { contains: params.q, mode: "insensitive" } },
            ],
          }
        : {},
      params.artist ? { artistName: { equals: params.artist, mode: "insensitive" } } : {},
      params.album ? { albumName: { equals: params.album, mode: "insensitive" } } : {},
      params.genre ? { genre: { equals: params.genre, mode: "insensitive" } } : {},
      params.mine && params.userId ? { uploadedById: params.userId } : {},
    ],
  };

  const skip = (params.page - 1) * params.pageSize;

  if (params.sort === "recentlyPlayed" && params.userId) {
    const history = await prisma.listeningHistory.findMany({
      where: { userId: params.userId },
      orderBy: { playedAt: "desc" },
      distinct: ["songId"],
      take: params.pageSize,
      skip,
      include: { song: true },
    });
    return {
      items: history.map((h) => h.song),
      page: params.page,
      pageSize: params.pageSize,
    };
  }

  const orderBy: Prisma.SongOrderByWithRelationInput =
    params.sort === "popular"
      ? { playCount: "desc" }
      : params.sort === "alphabetical"
      ? { title: "asc" }
      : { createdAt: "desc" };

  const [items, total] = await Promise.all([
    prisma.song.findMany({ where, orderBy, skip, take: params.pageSize }),
    prisma.song.count({ where }),
  ]);

  return { items, total, page: params.page, pageSize: params.pageSize };
}

export async function getSongById(songId: string) {
  const song = await prisma.song.findUnique({ where: { id: songId } });
  if (!song) throw new NotFoundError("Song not found");
  return song;
}

export async function recordPlay(userId: string, songId: string) {
  await prisma.$transaction([
    prisma.song.update({ where: { id: songId }, data: { playCount: { increment: 1 } } }),
    prisma.listeningHistory.create({ data: { userId, songId } }),
  ]);
}

export async function recordDownload(userId: string, songId: string) {
  const song = await getSongById(songId);
  if (!song.isDownloadable) {
    throw new NotFoundError("This song is not available for download");
  }
  await prisma.$transaction([
    prisma.song.update({ where: { id: songId }, data: { downloadCount: { increment: 1 } } }),
    prisma.download.create({ data: { userId, songId } }),
  ]);
  return song;
}

 export async function removeDownloadRecord(userId: string, songId: string) { 
  await prisma.download.deleteMany({ where: { userId, songId } }); 
}

export async function likeSong(userId: string, songId: string) {
  await getSongById(songId);

  await prisma.likedSong.upsert({
    where: { userId_songId: { userId, songId } },
    update: {},
    create: { userId, songId },
  });
}

export async function unlikeSong(userId: string, songId: string) {
  await prisma.likedSong.deleteMany({ where: { userId, songId } });
}

export async function getLikedSongs(userId: string) {
  const liked = await prisma.likedSong.findMany({
    where: { userId },
    orderBy: { likedAt: "desc" },
    include: { song: true },
  });

  return liked.map((l) => l.song);
}

export async function getLikedSongIds(userId: string) {
  const liked = await prisma.likedSong.findMany({
    where: { userId },
    select: { songId: true },
  });
  return liked.map((l) => l.songId);
}

export async function getRecentlyAdded(limit = 12) {
  return prisma.song.findMany({ orderBy: { createdAt: "desc" }, take: limit });
}

export async function getRecommended(userId: string, limit = 12) {
  // Simple content-based heuristic: most-played songs in genres the user
  // has listened to before, excluding songs already in their history.
  const recentGenres = await prisma.listeningHistory.findMany({
    where: { userId },
    orderBy: { playedAt: "desc" },
    take: 20,
    include: { song: { select: { genre: true } } },
  });
  const genres = [...new Set(recentGenres.map((h) => h.song.genre).filter(Boolean))] as string[];

  if (genres.length === 0) {
    return prisma.song.findMany({ orderBy: { playCount: "desc" }, take: limit });
  }

  const playedSongIds = recentGenres.map((h) => h.songId);
  return prisma.song.findMany({
    where: { genre: { in: genres }, id: { notIn: playedSongIds } },
    orderBy: { playCount: "desc" },
    take: limit,
  });
}

export async function deleteSong(songId: string) {
  const song = await getSongById(songId);
  const artworkKey = song.artworkStorageKey ?? (song.artworkUrl ? getStorageKeyFromUrl(song.artworkUrl) : undefined);
  const objectKeys = [song.audioStorageKey, artworkKey].filter((key): key is string => Boolean(key));
  try {
    await Promise.all(objectKeys.map((key) => deleteObject(key)));
  } catch {
    throw new AppError("Song files could not be removed. Please retry.", 503, "STORAGE_DELETE_FAILED");
  }
  await prisma.song.delete({ where: { id: songId } });
}

export async function assertCanManageSong(songId: string, userId: string) {
  const song = await prisma.song.findUnique({ where: { id: songId }, select: { id: true, uploadedById: true } });
  if (!song) throw new NotFoundError("Song not found");
  if (song.uploadedById === userId) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { isAdmin: true } });
  if (!user?.isAdmin) throw new ForbiddenError("You can only manage your own songs");
}

export async function updateSong(songId: string, userId: string, input: {
  title?: string;
  artist?: string;
  album?: string;
  genre?: string;
}) {
  await assertCanManageSong(songId, userId);
  const current = await getSongById(songId);
  const artistName = input.artist ?? current.artistName;
  const albumName = input.album === undefined ? current.albumName : input.album.trim() || null;
  const artist = await findOrCreateArtist(artistName);
  let albumId: string | null = null;
  if (albumName) albumId = (await findOrCreateAlbum(albumName, artist.id)).id;

  return prisma.song.update({
    where: { id: songId },
    data: {
      ...(input.title !== undefined ? { title: input.title } : {}),
      ...(input.artist !== undefined ? { artistName, artistId: artist.id } : {}),
      ...(input.album !== undefined || input.artist !== undefined ? { albumName, albumId } : {}),
      ...(input.genre !== undefined ? { genre: input.genre.trim() || null } : {}),
    },
  });
}

export async function deleteSongForUser(songId: string, userId: string) {
  await assertCanManageSong(songId, userId);
  return deleteSong(songId);
}
