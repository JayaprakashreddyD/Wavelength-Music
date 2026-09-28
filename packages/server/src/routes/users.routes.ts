import { Router } from "express";
import multer from "multer";
import { requireAuth, AuthedRequest } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import { requestEmailChangeSchema, updateProfileSchema } from "@/validators/auth";
import { inspectArtworkFile, uploadAvatar } from "@/middleware/upload";
import { deleteObject, getStorageKeyFromUrl, uploadObject } from "@/storage/s3";
import * as userService from "@/services/userService"; 
import * as songService from "@/services/songService";  
import { prisma } from "@/db/prisma"; 
import { z } from "zod";

export const usersRouter = Router();

usersRouter.use(requireAuth);

usersRouter.patch("/me", validate(updateProfileSchema), async (req: AuthedRequest, res) => {
  const user = await userService.updateProfile(req.userId!, req.body);
  res.json({ user });
});

usersRouter.post("/me/email-change", validate(requestEmailChangeSchema), async (req: AuthedRequest, res) => {
  await userService.requestEmailChange(req.userId!, req.body.email);
  res.json({ message: "Check your new email address for a verification link." });
});

usersRouter.post(
  "/me/avatar",
  (req, res, next) => uploadAvatar(req, res, (err) => {
    if (!err) return next();
    const tooLarge = err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE";
    return res.status(tooLarge ? 413 : 422).json({
      success: false,
      error: {
        code: tooLarge ? "FILE_TOO_LARGE" : "UPLOAD_ERROR",
        message: tooLarge ? "Avatar exceeds the configured size limit" : "Avatar upload was invalid",
      },
    });
  }),
  async (req: AuthedRequest, res) => {
    if (!req.file) return res.status(422).json({ success: false, error: { code: "MISSING_FILE", message: "avatar file required" } });
    const fileType = await inspectArtworkFile(req.file);
    const existing = await prisma.user.findUnique({ where: { id: req.userId! }, select: { profileImage: true } });
    const upload = await uploadObject(req.file.buffer, {
      folder: "avatars",
      extension: fileType.extension,
      contentType: fileType.mimeType,
    });
    let user;
    try {
      user = await prisma.user.update({
        where: { id: req.userId! },
        data: { profileImage: upload.url },
        select: { id: true, username: true, email: true, profileImage: true, createdAt: true },
      });
    } catch (error) {
      await deleteObject(upload.key).catch(() => undefined);
      throw error;
    }
    const oldKey = existing?.profileImage ? getStorageKeyFromUrl(existing.profileImage) : undefined;
    if (oldKey && oldKey !== upload.key) await deleteObject(oldKey).catch(() => undefined);
    res.json({ user });
  }
);

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(72),
});

usersRouter.post("/me/change-password", validate(changePasswordSchema), async (req: AuthedRequest, res) => {
  await userService.changePassword(req.userId!, req.body.currentPassword, req.body.newPassword);
  res.status(204).send();
});

usersRouter.get("/me/downloads", async (req: AuthedRequest, res) => {
  const downloads = await prisma.download.findMany({
    where: { userId: req.userId! },
    orderBy: { createdAt: "desc" },
    include: { song: true },
  });
  res.json({ items: downloads.map((d) => d.song) });
});

usersRouter.delete("/me/downloads/:songId", async (req: AuthedRequest, res) => {
  await songService.removeDownloadRecord(req.userId!, req.params.songId);
  res.status(204).send();
});

usersRouter.get("/me/liked-songs", async (req: AuthedRequest, res) => {
  res.json({ items: await songService.getLikedSongs(req.userId!) });
});

usersRouter.get("/me/liked-song-ids", async (req: AuthedRequest, res) => {
  res.json({ ids: await songService.getLikedSongIds(req.userId!) });
});

usersRouter.get("/me/recently-played", async (req: AuthedRequest, res) => {
  const history = await prisma.listeningHistory.findMany({
    where: { userId: req.userId! },
    orderBy: { playedAt: "desc" },
    distinct: ["songId"],
    take: 20,
    include: { song: true },
  });
  res.json({ items: history.map((h) => h.song) });
});
