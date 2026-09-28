"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { connectSocket } from "@/lib/socket";
import { usePlayer, setPlayerAudioState } from "@/lib/playerContext";
import { api } from "@/lib/api";
import { PlaybackSnapshot, QueueEntry, RoomMemberView, RoomRole, Song } from "@/lib/types";
import { useAuth } from "@/lib/authContext";

// --- Client-side synchronization algorithm (mirrors services/playbackService.ts) ---
//
// The server periodically ("room:sync") and on every state change
// ("room:state") sends { position, serverTimestamp, state }. The target
// playhead position at any later moment is:
//
//   target = position + (state === "PLAYING" ? (Date.now() - serverTimestamp) / 1000 : 0)
//
// This is recomputed fresh on every drift-check tick against the latest
// snapshot, so accumulated local clock skew is bounded by how often the
// server resends its state (every few seconds) rather than growing
// unbounded — the client never integrates its own clock over time, it
// just re-reads "how far is serverTimestamp from now" each tick.
//
// Drift correction then compares the *audio element's actual position*
// against that target:
//   - small drift (< HARD_SEEK_THRESHOLD): nudge playbackRate briefly so
//     the client gradually catches up/slows down — inaudible, no jump.
//   - large drift (>= HARD_SEEK_THRESHOLD): hard seek straight to target.

const DRIFT_CHECK_MS = 1000;
const HARD_SEEK_THRESHOLD_SECONDS = 1.5;
const SOFT_CORRECTION_RATE = { fast: 1.05, slow: 0.95 };
const SOFT_DRIFT_BAND = 0.15; // below this, don't bother correcting at all

export interface RoomSyncState {
  connected: boolean;
  role: RoomRole | null;
  hostId: string | null;
  members: RoomMemberView[];
  playback: PlaybackSnapshot | null;
  queue: QueueEntry[];
  currentSong: Song | null;
  lastQueueMessage: string | null;
  error: string | null;
}

export function useRoomSync(roomId: string | null) {
  const { audioRef, enterRoomMode, exitRoomMode } = usePlayer();
  const { user } = useAuth();
  const userIdRef = useRef<string | null>(user?.id ?? null);
  userIdRef.current = user?.id ?? null;
  const [state, setState] = useState<RoomSyncState>({
    connected: false,
    role: null,
    hostId: null,
    members: [],
    playback: null,
    queue: [],
    currentSong: null,
    lastQueueMessage: null,
    error: null,
  });

  const socketRef = useRef<Socket | null>(null);
  const anchorRef = useRef<PlaybackSnapshot | null>(null);
  const currentSongRef = useRef<Song | null>(null);

  const applySnapshot = useCallback((snapshot: PlaybackSnapshot, _serverNow: number) => {
    anchorRef.current = snapshot;
    setState((s) => ({ ...s, playback: snapshot }));
  }, []);

  const fetchSongIfNeeded = useCallback(async (songId: string | null) => {
    if (!songId) {
      currentSongRef.current = null;
      setState((s) => ({ ...s, currentSong: null }));
      return;
    }
    if (currentSongRef.current?.id === songId) return;
    try {
      const { song } = await api.get<{ song: Song }>(`/songs/${songId}`);
      currentSongRef.current = song;
      setState((s) => ({ ...s, currentSong: song }));
    } catch {
      /* ignore transient fetch errors */
    }
  }, []);

  useEffect(() => {
    if (!roomId) return;
    const socket = connectSocket();
    socketRef.current = socket;
    enterRoomMode(roomId);

    function onState(payload: any) {
      const myMembership = payload.room.members.find((m: RoomMemberView) => m.userId === userIdRef.current);
      setState((s) => ({
        ...s,
        role: myMembership?.role ?? s.role,
        hostId: payload.room.hostId,
        members: payload.room.members,
      }));
      applySnapshot(payload.playback, payload.serverNow);
      fetchSongIfNeeded(payload.playback.currentSongId);
    }
    function onQueueUpdate(payload: any) {
      setState((s) => ({
        ...s,
        queue: payload.queue,
        lastQueueMessage:
          typeof payload.added === "number"
            ? `${payload.added} songs added, ${payload.duplicatesSkipped} duplicates skipped.`
            : s.lastQueueMessage,
      }));
    }
    function onSync(payload: any) {
      applySnapshot(
        {
          roomId: payload.roomId,
          currentSongId: payload.currentSongId,
          state: payload.state,
          position: payload.position,
          serverTimestamp: payload.serverTimestamp,
          queueVersion: payload.queueVersion,
        },
        payload.serverNow
      );
    }
    function onMemberJoin(payload: RoomMemberView) {
      setState((s) => (s.members.some((m) => m.userId === payload.userId) ? s : { ...s, members: [...s.members, payload] }));
    }
    function onMemberLeave(payload: { userId: string }) {
      setState((s) => ({ ...s, members: s.members.filter((m) => m.userId !== payload.userId) }));
    }
    function onError(payload: { code: string; message: string }) {
      setState((s) => ({ ...s, error: payload.message }));
    }

    socket.on("room:state", onState);
    socket.on("room:queue-update", onQueueUpdate);
    socket.on("room:sync", onSync);
    socket.on("room:member-join", onMemberJoin);
    socket.on("room:member-leave", onMemberLeave);
    socket.on("room:host-migrated", (p: any) => setState((s) => ({ ...s, hostId: p.newHostId })));
    socket.on("error", onError);

    socket.emit("room:join", { roomId }, (ack: { ok: boolean; role?: RoomRole; error?: string }) => {
      if (ack.ok) {
        setState((s) => ({ ...s, connected: true, role: ack.role ?? s.role }));
      } else {
        setState((s) => ({ ...s, error: ack.error ?? "Failed to join room" }));
      }
    });

    return () => {
      socket.emit("room:leave", { roomId });
      socket.off("room:state", onState);
      socket.off("room:queue-update", onQueueUpdate);
      socket.off("room:sync", onSync);
      socket.off("room:member-join", onMemberJoin);
      socket.off("room:member-leave", onMemberLeave);
      socket.off("error", onError);
      exitRoomMode();
      anchorRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  // Drift-correction loop: applies the anchor snapshot to the actual
  // <audio> element, gradually or with a hard seek as appropriate.
  useEffect(() => {
    if (!roomId) return;
    const interval = setInterval(() => {
      const anchor = anchorRef.current;
      const audio = audioRef.current;
      if (!anchor || !audio) return;

      const snapshot = anchor;
      const elapsedSincePlaying =
        snapshot.state === "PLAYING" ? (Date.now() - snapshot.serverTimestamp) / 1000 : 0;
      const target = Math.max(0, snapshot.position + elapsedSincePlaying);

      const song = currentSongRef.current;
      const expectedSrc = song?.audioUrl;
      if (expectedSrc && audio.src !== expectedSrc) {
        setPlayerAudioState(audioRef, { src: expectedSrc, time: target, play: snapshot.state === "PLAYING" });
        audio.playbackRate = 1;
        return;
      }

      if (snapshot.state !== "PLAYING") {
        if (!audio.paused) audio.pause();
        if (Math.abs(audio.currentTime - target) > 0.2) audio.currentTime = target;
        audio.playbackRate = 1;
        return;
      }

      if (audio.paused) audio.play().catch(() => {});

      const drift = audio.currentTime - target; // positive = ahead, negative = behind
      const absDrift = Math.abs(drift);

      if (absDrift >= HARD_SEEK_THRESHOLD_SECONDS) {
        audio.currentTime = target;
        audio.playbackRate = 1;
      } else if (absDrift > SOFT_DRIFT_BAND) {
        audio.playbackRate = drift > 0 ? SOFT_CORRECTION_RATE.slow : SOFT_CORRECTION_RATE.fast;
      } else {
        audio.playbackRate = 1;
      }
    }, DRIFT_CHECK_MS);

    return () => clearInterval(interval);
  }, [roomId, audioRef]);

  // --- Privileged actions (server re-validates role on every one) ---

  const controls = {
    play: () => socketRef.current?.emit("room:play", { roomId }),
    pause: () => socketRef.current?.emit("room:pause", { roomId }),
    seek: (position: number) => socketRef.current?.emit("room:seek", { roomId, position }),
    changeSong: (songId: string, autoplay = true) =>
      socketRef.current?.emit("room:song-change", { roomId, songId, autoplay }),
    addSongs: (songIds: string[]) => socketRef.current?.emit("room:queue-add-songs", { roomId, songIds }),
    addPlaylist: (playlistId: string) =>
      socketRef.current?.emit("room:queue-add-playlist", { roomId, playlistId }),
    removeFromQueue: (songId: string) => socketRef.current?.emit("room:queue-remove", { roomId, songId }),
    reorderQueue: (orderedSongIds: string[]) =>
      socketRef.current?.emit("room:queue-reorder", { roomId, orderedSongIds }),
    promote: (userId: string) =>
      socketRef.current?.emit("room:role-change", { roomId, targetUserId: userId, action: "promote" }),
    demote: (userId: string) =>
      socketRef.current?.emit("room:role-change", { roomId, targetUserId: userId, action: "demote" }),
    removeMember: (userId: string) =>
      socketRef.current?.emit("room:role-change", { roomId, targetUserId: userId, action: "remove" }),
  };

  const canControl = state.role === "HOST" || state.role === "ELDER";
  const isHost = state.role === "HOST";

  return { ...state, controls, canControl, isHost };
}
