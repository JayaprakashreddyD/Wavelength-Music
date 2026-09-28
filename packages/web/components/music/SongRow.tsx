"use client";

import { Play, Pause, Heart, AudioLines } from "lucide-react";
import { Song } from "@/lib/types";
import { usePlayer } from "@/lib/playerContext";
import { useLikedSongs } from "@/lib/likedSongsContext";
import { SongActionsMenu } from "@/components/music/SongActionsMenu";
import { Artwork } from "@/components/music/Artwork";

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

export interface SongRowProps {
  song: Song;
  index?: number;
  queue?: Song[];
  onAddToPlaylist?: (song: Song) => void;
  onDeleted?: () => void;
  onUpdated?: (song: Song) => void;
  onAddToPlaylistAction?: (song: Song) => void;
  onDeletedAction?: () => void;
  onLikeToggled?: (songId: string, isLiked: boolean) => void;
}

export function SongRow({
  song,
  index,
  queue,
  onAddToPlaylist,
  onDeleted,
  onUpdated,
  onAddToPlaylistAction,
  onDeletedAction,
  onLikeToggled,
}: SongRowProps) {
  const { currentSong, isPlaying, play, pause, roomId } = usePlayer();
  const { isLiked, toggleLike } = useLikedSongs();
  const isCurrent = currentSong?.id === song.id;
  const liked = isLiked(song.id);

  const handleAddToPlaylist = onAddToPlaylist ?? onAddToPlaylistAction;
  const handleDeleted = onDeleted ?? onDeletedAction;

  async function handleLikeClick(e: React.MouseEvent) {
    e.stopPropagation();
    const newLiked = await toggleLike(song.id, song.title);
    onLikeToggled?.(song.id, newLiked);
  }

  return (
    <div className={`group grid min-h-[68px] grid-cols-[24px_minmax(0,1fr)_auto] items-center gap-3 border-b border-white/[0.045] px-2 py-2 transition-all sm:gap-4 sm:px-3 ${isCurrent ? "rounded-xl bg-accent/[0.1] shadow-[inset_3px_0_0_#00f59b,0_0_20px_rgba(0,245,155,0.06)]" : "hover:rounded-xl hover:bg-white/[0.05]"}`}>
      <div className="relative flex h-8 w-8 shrink-0 items-center justify-center text-sm text-base-300">
        {typeof index === "number" ? (
          <>
            <span className="transition-opacity group-hover:opacity-0 group-focus-within:opacity-0">
              {isCurrent && isPlaying ? (
                <Play size={14} className="text-accent-bright fill-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.6)]" />
              ) : (
                index + 1
              )}
            </span>
            <button
              className="absolute inset-0 flex h-8 w-8 items-center justify-center rounded-full text-white opacity-100 transition-opacity hover:bg-white/[0.08] sm:pointer-events-none sm:opacity-0 sm:group-hover:pointer-events-auto sm:group-hover:opacity-100 sm:group-focus-within:pointer-events-auto sm:group-focus-within:opacity-100"
              onClick={() => (isCurrent && isPlaying ? pause() : play(song, queue ?? [song]))}
              disabled={!!roomId}
              title={isCurrent && isPlaying ? "Pause" : "Play"}
            >
              {isCurrent && isPlaying ? <Pause size={14} className="text-accent-bright" /> : <Play size={14} />}
            </button>
          </>
        ) : (
          <button
            onClick={() => (isCurrent && isPlaying ? pause() : play(song, queue ?? [song]))}
            disabled={!!roomId}
            title={isCurrent && isPlaying ? "Pause" : "Play"}
          >
            {isCurrent && isPlaying ? (
              <Pause size={14} className="text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.6)]" />
            ) : (
              <Play size={14} className="text-white hover:text-accent-bright" />
            )}
          </button>
        )}
      </div>

      <div className="flex min-w-0 items-center gap-3">
        <Artwork src={song.artworkUrl} alt="" className={`h-11 w-11 shrink-0 rounded-[10px] object-cover transition-transform duration-300 group-hover:scale-[1.04] ${isCurrent && isPlaying ? "ring-2 ring-accent/40 shadow-[0_0_12px_rgba(0,245,155,0.25)]" : ""}`} />
        <div className="min-w-0">
          <div className="flex min-w-0 items-center gap-1.5">
            {isCurrent && isPlaying && <AudioLines size={13} className="shrink-0 text-accent-bright animate-pulse drop-shadow-[0_0_5px_rgba(0,245,155,0.6)]" aria-label="Now playing" />}
            <p className={`truncate text-sm font-semibold ${isCurrent ? "text-accent-bright drop-shadow-[0_0_8px_rgba(0,245,155,0.35)]" : "text-white"}`}>{song.title}</p>
          </div>
          <p className="truncate text-xs text-base-300 mt-0.5">{song.artistName}</p>
        </div>
      </div>

      <div className="flex items-center gap-3 text-xs text-base-300">
        <button
          onClick={handleLikeClick}
          title={liked ? "Unlike" : "Like"}
          aria-label={liked ? `Unlike ${song.title}` : `Like ${song.title}`}
          className={`flex h-9 w-9 items-center justify-center rounded-full opacity-100 transition-all sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100 ${
            liked
              ? "text-accent-bright opacity-100 drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]"
              : "text-transparent opacity-0 group-hover:text-base-300 group-hover:opacity-100 focus-visible:text-white focus-visible:opacity-100"
          }`}
        >
          <Heart size={16} className={liked ? "fill-accent-bright" : ""} />
        </button>
        <SongActionsMenu
          song={song}
          onAddToPlaylist={handleAddToPlaylist}
          onDeleted={handleDeleted}
          onUpdated={onUpdated}
        />
        <span className="w-10 text-right font-mono text-xs text-base-400">{formatTime(song.duration)}</span>
      </div>
    </div>
  );
}
