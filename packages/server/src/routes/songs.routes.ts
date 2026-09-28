import { NextFunction, Request, Response, Router } from "express";
import multer from "multer";
import { parseBuffer } from "music-metadata";
import { requireAuth, optionalAuth, AuthedRequest } from "@/middleware/auth";
import { uploadLimiter } from "@/middleware/rateLimit";
import { uploadSong, inspectAudioFile, inspectArtworkFile } from "@/middleware/upload";
import { validate } from "@/middleware/validate";
import { listSongsQuerySchema, updateSongMetadataSchema, uploadSongMetadataSchema } from "@/validators/songs";
import { deleteObject, uploadObject } from "@/storage/s3";
import * as songService from "@/services/songService";
import { AppError, UnauthorizedError } from "@/utils/errors";

export const songsRouter = Router();

function safeSong<T extends { audioStorageKey?: unknown; artworkStorageKey?: unknown }>(song: T) {
  const { audioStorageKey: _audioKey, artworkStorageKey: _artworkKey, ...publicSong } = song;
  return publicSong;
}

function handleUploadError(error: unknown, res: Response) {
  const fileTooLarge = error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE";
  const status = fileTooLarge ? 413 : error instanceof AppError ? error.statusCode : 422;
  const code = fileTooLarge ? "FILE_TOO_LARGE" : error instanceof AppError ? error.code : "UPLOAD_ERROR";
  const message = fileTooLarge
    ? "Uploaded file exceeds the configured size limit"
    : error instanceof AppError
      ? error.message
      : "Upload request was invalid";
  res.status(status).json({ success: false, error: { code, message } });
}

function runSongUpload(req: Request, res: Response, next: NextFunction) {
  uploadSong(req, res, (error) => error ? handleUploadError(error, res) : next());
}

async function uploadHandler(req: AuthedRequest, res: Response) {
  const files = req.files as { audio?: Express.Multer.File[]; artwork?: Express.Multer.File[] } | undefined;
  const audioFile = files?.audio?.[0];
  if (!audioFile) throw new AppError("Audio file is required", 422, "MISSING_AUDIO");

  const audioType = await inspectAudioFile(audioFile);
  const artworkFile = files?.artwork?.[0];
  const artworkType = artworkFile ? await inspectArtworkFile(artworkFile) : undefined;
  const metadata = await parseBuffer(audioFile.buffer, {
    mimeType: audioType.mimeType,
    path: `upload.${audioType.extension}`,
  }).catch(() => null);
  const duration = metadata?.format.duration ?? 0;
  if (!Number.isFinite(duration) || duration <= 0) {
    throw new AppError("Could not determine audio duration from file", 422, "INVALID_AUDIO");
  }

  const uploadedKeys: string[] = [];
  try {
    const audioUpload = await uploadObject(audioFile.buffer, {
      folder: "audio",
      extension: audioType.extension,
      contentType: audioType.mimeType,
    });
    uploadedKeys.push(audioUpload.key);

    let artworkUrl: string | undefined;
    let artworkStorageKey: string | undefined;
    if (artworkFile && artworkType) {
      const artworkUpload = await uploadObject(artworkFile.buffer, {
        folder: "artwork",
        extension: artworkType.extension,
        contentType: artworkType.mimeType,
      });
      uploadedKeys.push(artworkUpload.key);
      artworkUrl = artworkUpload.url;
      artworkStorageKey = artworkUpload.key;
    }

    const song = await songService.createSong({
      title: req.body.title,
      artist: req.body.artist,
      album: req.body.album,
      genre: req.body.genre,
      uploadedById: req.userId!,
      audioUrl: audioUpload.url,
      audioStorageKey: audioUpload.key,
      artworkUrl,
      artworkStorageKey,
      duration,
    });
    res.status(201).json({ success: true, song: safeSong(song) });
  } catch (error) {
    await Promise.allSettled(uploadedKeys.map((key) => deleteObject(key)));
    throw error;
  }
}

songsRouter.get("/mine", requireAuth, validate(listSongsQuerySchema, "query"), async (req: AuthedRequest, res) => {
  const query = req.query as any;
  const result = await songService.listSongs({ ...query, mine: true, userId: req.userId });
  res.json({ ...result, items: result.items.map(safeSong) });
});

songsRouter.get("/", optionalAuth, validate(listSongsQuerySchema, "query"), async (req: AuthedRequest, res) => {
  const query = req.query as any;
  if (query.mine && !req.userId) throw new UnauthorizedError();
  const result = await songService.listSongs({ ...query, userId: req.userId });
  res.json({ ...result, items: result.items.map(safeSong) });
});

songsRouter.get("/recently-added", async (_req, res) => {
  const items = await songService.getRecentlyAdded();
  res.json({ items: items.map(safeSong) });
});

songsRouter.get("/recommended", requireAuth, async (req: AuthedRequest, res) => {
  const items = await songService.getRecommended(req.userId!);
  res.json({ items: items.map(safeSong) });
});

songsRouter.get("/:id", async (req, res) => {
  const song = await songService.getSongById(req.params.id);
  res.json({ song: safeSong(song) });
});

const songUploadMiddleware = [
  requireAuth,
  uploadLimiter,
  runSongUpload,
  validate(uploadSongMetadataSchema),
  uploadHandler,
] as const;
songsRouter.post("/upload", ...songUploadMiddleware);
songsRouter.post("/", ...songUploadMiddleware);

songsRouter.patch("/:id", requireAuth, validate(updateSongMetadataSchema), async (req: AuthedRequest, res) => {
  const song = await songService.updateSong(req.params.id, req.userId!, req.body);
  res.json({ success: true, song: safeSong(song) });
});

songsRouter.delete("/:id", requireAuth, async (req: AuthedRequest, res) => {
  await songService.deleteSongForUser(req.params.id, req.userId!);
  res.status(204).send();
});

songsRouter.post("/:id/play", requireAuth, async (req: AuthedRequest, res) => {
  await songService.recordPlay(req.userId!, req.params.id);
  res.status(204).send();
});

songsRouter.post("/:id/download", requireAuth, async (req: AuthedRequest, res) => {
  const song = await songService.recordDownload(req.userId!, req.params.id);
  res.json({ downloadUrl: song.audioUrl, filename: `${song.artistName} - ${song.title}` });
});

songsRouter.post("/:id/like", requireAuth, async (req: AuthedRequest, res) => {
  await songService.likeSong(req.userId!, req.params.id);
  res.status(204).send();
});

songsRouter.delete("/:id/like", requireAuth, async (req: AuthedRequest, res) => {
  await songService.unlikeSong(req.userId!, req.params.id);
  res.status(204).send();
});
