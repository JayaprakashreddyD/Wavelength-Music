import { Router } from "express";
import { authRouter } from "@/routes/auth.routes";
import { songsRouter } from "@/routes/songs.routes";
import { playlistsRouter } from "@/routes/playlists.routes";
import { roomsRouter } from "@/routes/rooms.routes";
import { usersRouter } from "@/routes/users.routes";

export const apiRouter = Router();

apiRouter.use("/auth", authRouter);
apiRouter.use("/songs", songsRouter);
apiRouter.use("/playlists", playlistsRouter);
apiRouter.use("/rooms", roomsRouter);
apiRouter.use("/users", usersRouter);

apiRouter.get("/health", (_req, res) => res.json({ success: true, ok: true }));
