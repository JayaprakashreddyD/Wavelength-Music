"use client";

import Link from "next/link";
import {
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  Repeat,
  Repeat1,
  Shuffle,
  ListMusic,
  Radio,
  Heart,
} from "lucide-react";
import { useState } from "react";
import { usePlayer } from "@/lib/playerContext";
import { useLikedSongs } from "@/lib/likedSongsContext";
import { Artwork } from "@/components/music/Artwork";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export function Player() {
  const [queueOpen, setQueueOpen] = useState(false);
  const {
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
    toggle,
    next,
    previous,
    seek,
    setVolume,
    toggleMute,
    toggleShuffle,
    cycleRepeat,
    play,
  } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();

  if (!currentSong) {
    return (
      <div className="flex h-[76px] items-center justify-center border-t border-white/[0.08] bg-[#080d16]/95 px-4 text-center text-xs text-base-300 backdrop-blur-xl">
        Nothing playing — pick a song from your library or join a room.
      </div>
    );
  }

  return (
    <div data-playing={isPlaying} className="player-ambient relative flex h-[76px] items-center gap-2 border-t border-white/[0.09] bg-[#080d16]/95 px-3 shadow-[0_-12px_45px_rgba(0,0,0,.3)] backdrop-blur-xl sm:gap-4 sm:px-5">
      <div className="flex min-w-0 flex-1 items-center gap-2 sm:w-56 sm:flex-none sm:gap-3">
        <Artwork key={currentSong.id} src={currentSong.artworkUrl} alt={`${currentSong.title} artwork`} className={`player-track-art artwork-crossfade h-11 w-11 shrink-0 rounded-xl object-cover shadow-lg shadow-black/40 transition-transform duration-700 sm:h-12 sm:w-12 ${isPlaying ? "scale-[1.02] ring-2 ring-accent/30 shadow-[0_0_15px_rgba(0,245,155,0.2)]" : "scale-100"}`} />
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-1.5"><p key={`title-${currentSong.id}`} className="artwork-crossfade truncate text-sm font-semibold text-white">{currentSong.title}</p>{isPlaying && <span className="player-equalizer" aria-label="Playing"><i /><i /><i /><i /></span>}</div>
          <p key={`artist-${currentSong.id}`} className="artwork-crossfade truncate text-xs text-base-300">{currentSong.artistName}</p>
        </div>
        <button
          onClick={() => toggleLike(currentSong.id, currentSong.title)}
          title={isLiked(currentSong.id) ? "Unlike" : "Like"}
          aria-label={isLiked(currentSong.id) ? "Unlike song" : "Like song"}
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full transition-all ${
            isLiked(currentSong.id)
              ? "text-accent-bright drop-shadow-[0_0_8px_rgba(0,245,155,0.6)]"
              : "text-base-400 hover:text-white"
          }`}
        >
          <Heart
            size={18}
            className={isLiked(currentSong.id) ? "fill-accent-bright" : ""}
          />
        </button>
      </div>

      <div className="player-controls flex min-w-[92px] flex-1 flex-col items-center gap-1 sm:min-w-0 sm:flex-[1.2]">
        <div className="flex items-center gap-1 sm:gap-4">
          {!roomId && (
            <button aria-label={shuffle ? "Turn shuffle off" : "Turn shuffle on"} aria-pressed={shuffle} onClick={toggleShuffle} className={`hidden h-9 w-9 items-center justify-center rounded-full sm:flex transition-colors ${shuffle ? "text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]" : "text-base-400 hover:text-white"}`}>
              <Shuffle size={16} />
            </button>
          )}
          <button aria-label="Previous song" onClick={previous} disabled={!!roomId} className="hidden h-9 w-9 items-center justify-center rounded-full text-base-200 hover:bg-white/[0.08] hover:text-accent-bright disabled:opacity-30 sm:flex transition-colors">
            <SkipBack size={18} />
          </button>
          <button
            onClick={toggle}
            aria-label={isPlaying ? "Pause" : "Play"}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-base-950 font-bold shadow-[0_0_22px_rgba(0,245,155,0.45),0_4px_12px_rgba(0,245,155,0.3)] transition hover:scale-105 hover:bg-accent-bright hover:shadow-[0_0_30px_rgba(0,245,155,0.65)] active:scale-95"
          >
            {isPlaying ? <Pause size={18} /> : <Play size={18} className="ml-0.5" />}
          </button>
          <button aria-label="Next song" onClick={next} disabled={!!roomId} className="flex h-9 w-9 items-center justify-center rounded-full text-base-200 hover:bg-white/[0.08] hover:text-accent-bright disabled:opacity-30 transition-colors">
            <SkipForward size={18} />
          </button>
          {roomId ? <Link href={`/rooms/${roomId}`} aria-label="Open room queue" className="flex h-9 w-9 items-center justify-center rounded-full text-base-200 hover:bg-white/[0.08] hover:text-accent-bright sm:hidden"><ListMusic size={16} /></Link> : <button aria-label="Open queue" aria-expanded={queueOpen} onClick={() => setQueueOpen((open) => !open)} className="flex h-9 w-9 items-center justify-center rounded-full text-base-200 hover:bg-white/[0.08] hover:text-accent-bright sm:hidden"><ListMusic size={16} /></button>}
          {!roomId && (
            <button aria-label={`Repeat ${repeat}`} aria-pressed={repeat !== "off"} onClick={cycleRepeat} className={`hidden h-9 w-9 items-center justify-center rounded-full sm:flex transition-colors ${repeat !== "off" ? "text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]" : "text-base-400 hover:text-white"}`}>
              {repeat === "one" ? <Repeat1 size={16} /> : <Repeat size={16} />}
            </button>
          )}
        </div>
        <div className="player-progress flex w-full max-w-xl items-center gap-2 text-[11px] text-base-300">
          <span className="hidden w-9 text-right sm:inline font-mono">{formatTime(currentTime)}</span>
          <input
            type="range"
            min={0}
            max={duration || 0}
            value={Math.min(currentTime, duration || 0)}
            onChange={(e) => seek(Number(e.target.value))}
            disabled={!!roomId}
            aria-label="Seek through song"
            className="range-accent h-1.5 flex-1 disabled:opacity-50 cursor-pointer"
          />
          <span className="hidden w-9 sm:inline font-mono">{formatTime(duration)}</span>
        </div>
      </div>

      <div className="hidden w-56 items-center justify-end gap-3 sm:flex">
        {roomId && (
          <Link
            href={`/rooms/${roomId}`}
            className="flex items-center gap-1.5 rounded-full border border-room/40 bg-room/20 px-2.5 py-1 text-[11px] font-semibold text-room-bright shadow-[0_0_14px_rgba(168,85,247,0.3)] transition hover:bg-room/30"
          >
            <span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-room-bright shadow-[0_0_6px_#c084fc]" />
            <Radio size={12} /> Synced
          </Link>
        )}
        {roomId ? <Link href={`/rooms/${roomId}`} aria-label="Open room queue" className="flex h-9 w-9 items-center justify-center rounded-full text-base-300 hover:bg-white/[0.08] hover:text-white"><ListMusic size={16} /></Link> : <button aria-label="Open queue" aria-expanded={queueOpen} onClick={() => setQueueOpen((open) => !open)} className={`flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-white/[0.08] hover:text-white ${queueOpen ? "text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]" : "text-base-400"}`}><ListMusic size={16} /></button>}
        <button aria-label={muted || volume === 0 ? "Unmute" : "Mute"} onClick={toggleMute} className="flex h-9 w-9 items-center justify-center rounded-full text-base-300 hover:bg-white/[0.08] hover:text-white transition-colors">
          {muted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
        </button>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={muted ? 0 : volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          aria-label="Volume"
          className="range-accent h-1.5 w-20 cursor-pointer"
        />
      </div>
      {queueOpen && <section aria-label="Playback queue" className="absolute bottom-[calc(100%+12px)] right-3 z-50 w-[min(22rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-white/15 bg-[#0f1725]/95 p-3.5 shadow-[0_24px_80px_rgba(0,0,0,.7),0_0_35px_rgba(0,245,155,0.1)] backdrop-blur-2xl sm:right-5"><div className="mb-3 flex items-center justify-between border-b border-white/[0.08] pb-3"><div><h2 className="text-sm font-semibold text-white">Up next</h2><p className="mt-0.5 text-[11px] text-base-300">{Math.max(0, queue.length - currentIndex - 1)} tracks in queue</p></div><button onClick={() => setQueueOpen(false)} className="rounded-lg px-3 py-1.5 text-xs text-base-300 hover:bg-white/[0.08] hover:text-white">Close</button></div><div className="max-h-72 space-y-1 overflow-y-auto">{queue.length <= currentIndex + 1 ? <p className="px-2 py-5 text-center text-xs text-base-400">The queue is clear. Choose a collection to keep listening.</p> : queue.slice(currentIndex + 1).map((song, index) => <button key={`${song.id}-${index}`} onClick={() => { play(song, queue); setQueueOpen(false); }} className="flex min-h-14 w-full items-center gap-3 rounded-xl px-2 py-1.5 text-left transition-colors hover:bg-white/[0.08]"><Artwork src={song.artworkUrl} alt="" className="h-10 w-10 shrink-0 rounded-lg object-cover" /><span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-white">{song.title}</span><span className="block truncate text-xs text-base-300">{song.artistName}</span></span></button>)}</div></section>}
    </div>
  );
}
