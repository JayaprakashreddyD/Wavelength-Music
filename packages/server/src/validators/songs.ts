import { z } from "zod";

export const uploadSongMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200),
  artist: z.string().trim().min(1).max(200),
  album: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(60).optional(),
});

export const updateSongMetadataSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  artist: z.string().trim().min(1).max(200).optional(),
  album: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(60).optional(),
}).refine((input) => Object.values(input).some((value) => value !== undefined), {
  message: "At least one song field must be provided",
});

export const listSongsQuerySchema = z.object({
  q: z.string().trim().max(200).optional(),
  artist: z.string().trim().max(200).optional(),
  album: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(60).optional(),
  mine: z.coerce.boolean().optional(),
  sort: z.enum(["recent", "popular", "recentlyPlayed", "alphabetical"]).optional().default("recent"),
  page: z.coerce.number().int().min(1).optional().default(1),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
}).transform(({ limit, pageSize, ...query }) => ({
  ...query,
  pageSize: limit ?? pageSize ?? 20,
}));
