import { Router } from "express";
import { requireAuth, AuthedRequest } from "@/middleware/auth";
import { validate } from "@/middleware/validate";
import {
  addPlaylistToQueueSchema,
  addSongsToQueueSchema,
  createRoomSchema,
  joinPrivateRoomSchema,
} from "@/validators/rooms";
import * as roomService from "@/services/roomService";
import * as queueService from "@/services/queueService";
import * as playbackService from "@/services/playbackService";
import { can } from "@/sockets/permissions";
import { ForbiddenError } from "@/utils/errors";

export const roomsRouter = Router();

roomsRouter.use(requireAuth);

// Public room discovery list. Private rooms are never returned here —
// they're only reachable via room code.
roomsRouter.get("/", async (_req, res) => {
  res.json({ items: await roomService.listPublicRooms() });
});

roomsRouter.post("/", validate(createRoomSchema), async (req: AuthedRequest, res) => {
  const room = await roomService.createRoom(req.userId!, req.body);
  res.status(201).json({ room });
});

roomsRouter.post("/join", validate(joinPrivateRoomSchema), async (req: AuthedRequest, res) => {
  const membership = await roomService.joinPrivateRoomByCode(req.body.code, req.userId!);
  res.json({ membership });
});

roomsRouter.post("/:id/join", async (req: AuthedRequest, res) => {
  const membership = await roomService.joinPublicRoom(req.params.id, req.userId!);
  res.json({ membership });
});

roomsRouter.get("/mine", async (req: AuthedRequest, res) => {
  res.json({ items: await roomService.listMyRooms(req.userId!) });
});

roomsRouter.get("/:id", async (req: AuthedRequest, res) => {
  const room = await roomService.getRoomDetail(req.params.id);
  // A private room's code is only revealed to its own members/host, not to
  // arbitrary authenticated users probing room IDs.
  const isMember = room.members.some((m) => m.userId === req.userId);
  res.json({ room: isMember ? room : { ...room, code: undefined } });
});

roomsRouter.get("/:id/members", async (req, res) => {
  const room = await roomService.getRoomDetail(req.params.id);
  res.json({ items: room.members });
});

roomsRouter.get("/:id/queue", async (req, res) => {
  res.json({ items: await queueService.getQueue(req.params.id) });
});

roomsRouter.get("/:id/playback", async (req, res) => {
  const snapshot = await playbackService.getPlaybackState(req.params.id);
  res.json({
    ...snapshot,
    computedPosition: playbackService.computeCurrentPosition(snapshot),
    serverNow: Date.now(),
  });
});

async function requirePrivileged(roomId: string, userId: string, action: Parameters<typeof can>[1]) {
  const role = await roomService.getMemberRole(roomId, userId);
  if (!can(role, action)) throw new ForbiddenError("You don't have permission to do this in this room");
}

roomsRouter.post("/:id/queue/songs", validate(addSongsToQueueSchema), async (req: AuthedRequest, res) => {
  await requirePrivileged(req.params.id, req.userId!, "ADD_SONGS");
  const result = await queueService.addSongsToQueue(req.params.id, req.userId!, req.body.songIds);
  res.status(201).json({
    added: result.added,
    duplicatesSkipped: result.duplicatesSkipped,
    message: `${result.added} songs added, ${result.duplicatesSkipped} duplicates skipped.`,
    queue: result.queue,
  });
});

roomsRouter.post("/:id/queue/playlists", validate(addPlaylistToQueueSchema), async (req: AuthedRequest, res) => {
  await requirePrivileged(req.params.id, req.userId!, "ADD_PLAYLIST");
  const result = await queueService.addPlaylistToQueue(req.params.id, req.userId!, req.body.playlistId);
  res.status(201).json({
    added: result.added,
    duplicatesSkipped: result.duplicatesSkipped,
    message: `${result.added} songs added, ${result.duplicatesSkipped} duplicates skipped.`,
    queue: result.queue,
  });
});

roomsRouter.delete("/:id/queue/songs/:songId", async (req: AuthedRequest, res) => {
  await requirePrivileged(req.params.id, req.userId!, "REMOVE_SONG");
  const queue = await queueService.removeSongFromQueue(req.params.id, req.params.songId);
  res.json({ items: queue });
});

roomsRouter.post("/:id/members/:userId/promote", async (req: AuthedRequest, res) => {
  const member = await roomService.promoteToElder(req.params.id, req.userId!, req.params.userId);
  res.json({ member });
});

roomsRouter.post("/:id/members/:userId/demote", async (req: AuthedRequest, res) => {
  const member = await roomService.demoteToMember(req.params.id, req.userId!, req.params.userId);
  res.json({ member });
});

roomsRouter.delete("/:id/members/:userId", async (req: AuthedRequest, res) => {
  await roomService.removeMember(req.params.id, req.userId!, req.params.userId);
  res.status(204).send();
});

roomsRouter.post("/:id/leave", async (req: AuthedRequest, res) => {
  const result = await roomService.leaveRoom(req.params.id, req.userId!);
  res.json({ result });
});

roomsRouter.post("/:id/end", async (req: AuthedRequest, res) => {
  await roomService.endRoom(req.params.id, req.userId!);
  res.status(204).send();
});
