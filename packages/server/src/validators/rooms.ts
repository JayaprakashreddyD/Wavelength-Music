import { z } from "zod";

export const createRoomSchema = z.object({
  name: z.string().min(1).max(120),
  description: z.string().max(500).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const joinPrivateRoomSchema = z.object({
  code: z
    .string()
    .length(6)
    .regex(/^[A-Z0-9]{6}$/),
});

export const addSongsToQueueSchema = z.object({
  songIds: z.array(z.string().min(1)).min(1).max(200),
});

export const addPlaylistToQueueSchema = z.object({
  playlistId: z.string().min(1),
});
