"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { Song } from "@/lib/types";
import { api } from "@/lib/api";

interface PlayerContextValue {
  queue: Song[];
  currentIndex: number;
  currentSong: Song | null;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeat: "off" | "all" | "one";
  // When a room is active, the player becomes a "follower" of that room's
  // server-authoritative state instead of controlling local playback
  // freely — see RoomSyncClient, which drives currentTime/isPlaying here.
  roomId: string | null;
  play: (song?: Song, queue?: Song[]) => void;
  pause: () => void;
  toggle: () => void;
  next: () => void;
  previous: () => void;
  seek: (time: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  toggleShuffle: () => void;
  cycleRepeat: () => void;
  enterRoomMode: (roomId: string) => void;
  exitRoomMode: () => void; addToQueue: (song: Song) => void; audioRef: React.RefObject<HTMLAudioElement>; }
const PlayerContext = createContext<PlayerContextValue | null>(null);

export function PlayerProvider({ children }: { children: React.ReactNode }) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [queue, setQueueState] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolumeState] = useState(0.8);
  const [muted, setMuted] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [repeat, setRepeat] = useState<"off" | "all" | "one">("off");
  const [roomId, setRoomId] = useState<string | null>(null);

  const currentSong = currentIndex >= 0 ? queue[currentIndex] ?? null : null;

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const onTime = () => setCurrentTime(audio.currentTime);
    const onLoaded = () => setDuration(audio.duration || 0);
    const onEnded = () => {
      if (roomId) return; // room mode: server decides song end, not the client
      if (repeat === "one") {
        audio.currentTime = 0;
        audio.play();
        return;
      }
      handleNext();
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("ended", onEnded);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [repeat, roomId, queue, currentIndex]);

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = muted ? 0 : volume;
    }
  }, [volume, muted]);

  const loadAndMaybePlay = useCallback((song: Song, autoplay: boolean) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.src !== song.audioUrl) {
      audio.src = song.audioUrl;
    }
    if (autoplay) {
      audio.play().catch(() => {});
      setIsPlaying(true);
      api.post(`/songs/${song.id}/play`).catch(() => {});
    }
  }, []);

  const play = useCallback(
    (song?: Song, newQueue?: Song[]) => {
      if (roomId) return; // ignore local play calls while following a room
      if (song) {
        const effectiveQueue = newQueue ?? [song];
        const idx = effectiveQueue.findIndex((s) => s.id === song.id);
        setQueueState(effectiveQueue);
        setCurrentIndex(idx === -1 ? 0 : idx);
        loadAndMaybePlay(song, true);
        return;
      }
      audioRef.current?.play().catch(() => {});
      setIsPlaying(true);
    },
    [roomId, loadAndMaybePlay]
  );

  const pause = useCallback(() => {
    if (roomId) return;
    audioRef.current?.pause();
    setIsPlaying(false);
  }, [roomId]);

  const toggle = useCallback(() => {
    if (isPlaying) pause();
    else play();
  }, [isPlaying, pause, play]);

  const handleNext = useCallback(() => {
    if (roomId || queue.length === 0) return;
    let nextIdx: number;
    if (shuffle) {
      nextIdx = Math.floor(Math.random() * queue.length);
    } else {
      nextIdx = currentIndex + 1;
      if (nextIdx >= queue.length) {
        if (repeat === "all") nextIdx = 0;
        else {
          setIsPlaying(false);
          return;
        }
      }
    }
    setCurrentIndex(nextIdx);
    loadAndMaybePlay(queue[nextIdx], true);
  }, [roomId, queue, currentIndex, shuffle, repeat, loadAndMaybePlay]);

  const previous = useCallback(() => {
    if (roomId || queue.length === 0) return;
    if (audioRef.current && audioRef.current.currentTime > 3) {
      audioRef.current.currentTime = 0;
      return;
    }
    const prevIdx = Math.max(0, currentIndex - 1);
    setCurrentIndex(prevIdx);
    loadAndMaybePlay(queue[prevIdx], true);
  }, [roomId, queue, currentIndex, loadAndMaybePlay]);

  const seek = useCallback(
    (time: number) => {
      if (roomId) return; // room mode: seeking goes through RoomSyncClient -> socket
      if (audioRef.current) audioRef.current.currentTime = time;
      setCurrentTime(time);
    },
    [roomId]
  );

  const setVolume = useCallback((v: number) => {
    setVolumeState(Math.min(1, Math.max(0, v)));
    setMuted(false);
  }, []);

  const toggleMute = useCallback(() => setMuted((m) => !m), []);
  const toggleShuffle = useCallback(() => setShuffle((s) => !s), []);
  const cycleRepeat = useCallback(() => {
    setRepeat((r) => (r === "off" ? "all" : r === "all" ? "one" : "off"));
  }, []);

  const enterRoomMode = useCallback((id: string) => {
    setRoomId(id);
    setQueueState([]);
    setCurrentIndex(-1);
  }, []);

  const exitRoomMode = useCallback(() => { setRoomId(null); audioRef.current?.pause(); setIsPlaying(false); }, []); const addToQueue = useCallback( (song: Song) => { if (roomId) return; setQueueState((q) => [...q, song]); setCurrentIndex((idx) => (idx === -1 ? 0 : idx)); }, [roomId] ); const value = useMemo<PlayerContextValue>(
    () => ({
      queue,
      currentIndex,
      currentSong,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      roomId,
      play,
      pause,
      toggle,
      next: handleNext,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      addToQueue,
      enterRoomMode,
      exitRoomMode,
      audioRef,
    }),
    [
      queue,
      currentIndex,
      currentSong,
      isPlaying,
      currentTime,
      duration,
      volume,
      muted,
      shuffle,
      repeat,
      roomId,
      play,
      pause,
      toggle,
      handleNext,
      previous,
      seek,
      setVolume,
      toggleMute,
      toggleShuffle,
      cycleRepeat,
      enterRoomMode,
      exitRoomMode,
      addToQueue,
    ]
  );

  return (
    <PlayerContext.Provider value={value}>
      {children}
      <audio ref={audioRef} preload="metadata" />
    </PlayerContext.Provider>
  );
}

export function usePlayer() {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error("usePlayer must be used within PlayerProvider");
  return ctx;
}

// Exposed so RoomSyncClient (a room-mode-only component) can push
// server-driven playback changes into the same audio element without
// duplicating an <audio> tag or fighting the global player for control.
export function setPlayerAudioState(
  audioRef: React.RefObject<HTMLAudioElement>,
  opts: { src?: string; play?: boolean; time?: number }
) {
  const audio = audioRef.current;
  if (!audio) return;
  if (opts.src && audio.src !== opts.src) audio.src = opts.src;
  if (typeof opts.time === "number" && Math.abs(audio.currentTime - opts.time) > 0.15) {
    audio.currentTime = opts.time;
  }
  if (opts.play === true) audio.play().catch(() => {});
  if (opts.play === false) audio.pause();
}
