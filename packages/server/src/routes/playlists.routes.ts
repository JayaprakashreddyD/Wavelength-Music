import { Router } from "express";
import { requireAuth, AuthedRequest } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  addSongToPlaylistSchema,
  createPlaylistSchema,
  reorderPlaylistSchema,
  updatePlaylistSchema,
} from "@/validators/playlists";
import * as playlistService from "@/services/playlistService";

export const playlistsRouter = Router();

playlistsRouter.use(requireAuth);

playlistsRouter.get("/", async (req: AuthedRequest, res) => {
  res.json({ items: await playlistService.getUserPlaylists(req.userId!) });
});

playlistsRouter.post("/", validate(createPlaylistSchema), async (req: AuthedRequest, res) => {
  const playlist = await playlistService.createPlaylist(req.userId!, req.body);
  res.status(201).json({ playlist });
});

playlistsRouter.get("/:id", async (req, res) => {
  res.json({ playlist: await playlistService.getPlaylistWithSongs(req.params.id) });
});

playlistsRouter.patch("/:id", validate(updatePlaylistSchema), async (req: AuthedRequest, res) => {
  const playlist = await playlistService.renamePlaylist(req.params.id, req.userId!, req.body);
  res.json({ playlist });
});

playlistsRouter.delete("/:id", async (req: AuthedRequest, res) => {
  await playlistService.deletePlaylist(req.params.id, req.userId!);
  res.status(204).send();
});

playlistsRouter.post("/:id/songs", validate(addSongToPlaylistSchema), async (req: AuthedRequest, res) => {
  const entry = await playlistService.addSongToPlaylist(req.params.id, req.userId!, req.body.songId);
  res.status(201).json({ entry });
});

playlistsRouter.delete("/:id/songs/:songId", async (req: AuthedRequest, res) => {
  await playlistService.removeSongFromPlaylist(req.params.id, req.userId!, req.params.songId);
  res.status(204).send();
});

playlistsRouter.put("/:id/order", validate(reorderPlaylistSchema), async (req: AuthedRequest, res) => {
  await playlistService.reorderPlaylist(req.params.id, req.userId!, req.body.orderedSongIds);
  res.status(204).send();
});
