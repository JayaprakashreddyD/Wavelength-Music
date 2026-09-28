import { EventEmitter } from "events";
import { PlaybackState, Prisma } from "@prisma/client";
import { prisma } from "@/db/prisma";
import { NotFoundError } from "@/utils/errors";
import { getSongById } from "@/services/songService";
import { isSongInQueue, peekNext, removeSongFromQueue } from "@/services/queueService";

type TxClient = Prisma.TransactionClient;

export interface PlaybackSnapshot {
  roomId: string;
  currentSongId: string | null;
  state: PlaybackState;
  position: number;
  serverTimestamp: number; // ms epoch, number (not bigint) for JSON transport
  queueVersion: number;
}

// Emits "song-ended" and "state-changed" so the socket layer can broadcast
// without playbackService needing to know about Socket.IO. Keeps the
// synchronization math testable independent of transport.
export const playbackEvents = new EventEmitter();

// Per-room timers that fire when the current song is expected to end, so
// the server — not any individual client — decides when to advance the
// queue. NOTE: this in-memory map only works for a single server process;
// a multi-instance deployment should replace it with a Redis-backed
// scheduler (e.g. a sorted set of due times polled by every instance, or
// BullMQ delayed jobs) so only one instance ever fires the transition.
const songEndTimers = new Map<string, NodeJS.Timeout>();

function toSnapshot(row: {
  roomId: string;
  currentSongId: string | null;
  state: PlaybackState;
  position: number;
  serverTimestamp: bigint;
  queueVersion: number;
}): PlaybackSnapshot {
  return {
    roomId: row.roomId,
    currentSongId: row.currentSongId,
    state: row.state,
    position: row.position,
    serverTimestamp: Number(row.serverTimestamp),
    queueVersion: row.queueVersion,
  };
}

export async function getPlaybackState(roomId: string): Promise<PlaybackSnapshot> {
  const row = await prisma.roomPlaybackState.findUnique({ where: { roomId } });
  if (!row) throw new NotFoundError("Room playback state not found");
  return toSnapshot(row);
}

// The core synchronization primitive: given a stored snapshot, compute
// where a client's playhead *should* be right now. Every client runs this
// same function against the same snapshot, so — modulo network latency
// and clock skew, both small relative to perceptible drift — all clients
// converge on the same position. See section 14 of the spec: for PLAYING
// state this is `position + (now - serverTimestamp)`; for PAUSED/STOPPED
// the stored position is authoritative and doesn't advance.
export function computeCurrentPosition(snapshot: PlaybackSnapshot, nowMs: number = Date.now()): number {
  if (snapshot.state !== "PLAYING") return snapshot.position;
  const elapsedSeconds = (nowMs - snapshot.serverTimestamp) / 1000;
  return Math.max(0, snapshot.position + elapsedSeconds);
}

async function writeState(
  roomId: string,
  data: Partial<Pick<PlaybackSnapshot, "currentSongId" | "state" | "position">>,
  tx: TxClient = prisma
): Promise<PlaybackSnapshot> {
  const row = await tx.roomPlaybackState.update({
    where: { roomId },
    data: { ...data, serverTimestamp: BigInt(Date.now()) },
  });
  return toSnapshot(row);
}

export async function bumpQueueVersion(roomId: string, tx: TxClient = prisma) {
  await tx.roomPlaybackState.update({
    where: { roomId },
    data: { queueVersion: { increment: 1 } },
  });
}

export async function playPause(roomId: string, action: "play" | "pause"): Promise<PlaybackSnapshot> {
  const current = await getPlaybackState(roomId);

  if (action === "pause") {
    if (current.state !== "PLAYING") return current;
    const frozenPosition = computeCurrentPosition(current);
    const next = await writeState(roomId, { state: "PAUSED", position: frozenPosition });
    clearSongEndTimer(roomId);
    playbackEvents.emit("state-changed", next);
    return next;
  }

  // action === "play"
  if (!current.currentSongId) return current; // nothing queued to play
  if (current.state === "PLAYING") return current;
  const next = await writeState(roomId, { state: "PLAYING" }); // resumes from stored position
  await scheduleSongEnd(roomId, next);
  playbackEvents.emit("state-changed", next);
  return next;
}

export async function seek(roomId: string, position: number): Promise<PlaybackSnapshot> {
  const current = await getPlaybackState(roomId);
  const next = await writeState(roomId, { position: Math.max(0, position) });
  if (current.state === "PLAYING") {
    await scheduleSongEnd(roomId, next);
  }
  playbackEvents.emit("state-changed", next);
  return next;
}

// Switches the room's current song. `autoplay` controls whether playback
// starts immediately (true for host/elder-initiated skips) or the room
// stays paused on the new track. If the song being switched to was
// sitting in the "up next" queue (the common case — someone clicked a
// queued track, or this is being called by the auto-advance flow below),
// it's removed from the queue since it's no longer "up next", it's now
// playing.
export async function changeSong(
  roomId: string,
  songId: string,
  opts: { autoplay: boolean } = { autoplay: true }
): Promise<PlaybackSnapshot> {
  await getSongById(songId); // throws NotFoundError if invalid

  if (await isSongInQueue(roomId, songId)) {
    await removeSongFromQueue(roomId, songId);
  }

  const next = await writeState(roomId, {
    currentSongId: songId,
    state: opts.autoplay ? "PLAYING" : "PAUSED",
    position: 0,
  });

  clearSongEndTimer(roomId);
  if (opts.autoplay) await scheduleSongEnd(roomId, next);

  playbackEvents.emit("song-changed", next);
  return next;
}

export async function stop(roomId: string): Promise<PlaybackSnapshot> {
  const next = await writeState(roomId, { state: "STOPPED", currentSongId: null, position: 0 });
  clearSongEndTimer(roomId);
  playbackEvents.emit("state-changed", next);
  return next;
}

function clearSongEndTimer(roomId: string) {
  const existing = songEndTimers.get(roomId);
  if (existing) {
    clearTimeout(existing);
    songEndTimers.delete(roomId);
  }
}

async function scheduleSongEnd(roomId: string, snapshot: PlaybackSnapshot) {
  clearSongEndTimer(roomId);
  if (!snapshot.currentSongId || snapshot.state !== "PLAYING") return;

  const song = await getSongById(snapshot.currentSongId);
  const remainingSeconds = Math.max(0, song.duration - snapshot.position);

  const timer = setTimeout(async () => {
    await advanceQueueOnSongEnd(roomId, snapshot.currentSongId!);
  }, remainingSeconds * 1000);

  songEndTimers.set(roomId, timer);
}

// Server-driven auto-advance: when a track finishes, the server (not any
// individual client) decides the next song and broadcasts it, so clients
// never race each other to advance the queue independently.
async function advanceQueueOnSongEnd(roomId: string, finishedSongId: string) {
  const nextEntry = await peekNext(roomId);
  await removeSongFromQueue(roomId, finishedSongId);

  if (!nextEntry) {
    const next = await stop(roomId);
    playbackEvents.emit("song-ended", { roomId, next: null });
    return next;
  }

  const next = await changeSong(roomId, nextEntry.songId, { autoplay: true });
  playbackEvents.emit("song-ended", { roomId, next });
  return next;
}

// Called on server startup (or when a room's first member connects) to
// resume auto-advance timers for rooms that were already playing —
// otherwise a server restart would silently stop auto-advance until the
// next manual action.
export async function rehydrateTimersForActiveRooms() {
  const playing = await prisma.roomPlaybackState.findMany({ where: { state: "PLAYING" } });
  for (const row of playing) {
    await scheduleSongEnd(row.roomId, toSnapshot(row));
  }
}
