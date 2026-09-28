import { z } from "zod";

export const createPlaylistSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
});

export const updatePlaylistSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  description: z.string().max(500).optional(),
});

export const addSongToPlaylistSchema = z.object({
  songId: z.string().min(1),
});

export const reorderPlaylistSchema = z.object({
  orderedSongIds: z.array(z.string().min(1)).min(1),
});
