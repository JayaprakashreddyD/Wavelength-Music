"use client";

import { Play, Pause } from "lucide-react";
import { Song } from "@/lib/types";
import { usePlayer } from "@/lib/playerContext";
import { Artwork } from "@/components/music/Artwork";

export function SongCard({ song, queue }: { song: Song; queue?: Song[] }) {
  const { play, toggle, roomId, currentSong, isPlaying } = usePlayer();
  const selected = currentSong?.id === song.id;
  return (
    <button
      onClick={() => selected && isPlaying ? toggle() : play(song, queue ?? [song])}
      disabled={!!roomId}
      aria-label={`Play ${song.title} by ${song.artistName}`}
      aria-pressed={selected}
      className={`group w-44 shrink-0 rounded-2xl border p-3 text-left transition-all duration-300 hover:-translate-y-1.5 hover:border-accent/40 hover:bg-white/[0.06] hover:shadow-[0_16px_40px_rgba(0,0,0,.4),0_0_25px_rgba(0,245,155,0.12)] disabled:opacity-50 ${selected ? "border-accent/40 bg-accent/[0.09] shadow-[0_0_25px_rgba(0,245,155,0.12)]" : "border-white/[0.08] bg-white/[0.03]"}`}
    >
      <div className="artwork-frame relative mb-3 rounded-xl">
        <Artwork src={song.artworkUrl} alt={`${song.title} artwork`} className="aspect-square w-full rounded-xl object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-white/[0.08] opacity-70 transition-opacity duration-300 group-hover:opacity-100" />
        <div className="absolute bottom-2.5 right-2.5 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-accent text-base-950 font-bold opacity-0 shadow-[0_0_20px_rgba(0,245,155,0.5),0_4px_10px_rgba(0,0,0,0.3)] transition-all duration-200 group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100 hover:scale-110 hover:bg-accent-bright">
          {selected && isPlaying ? <Pause size={16} /> : <Play size={16} className="ml-0.5" />}
        </div>
      </div>
      <p className={`truncate text-sm font-semibold ${selected ? "text-accent-bright drop-shadow-[0_0_8px_rgba(0,245,155,0.35)]" : "text-white"}`}>{song.title}</p>
      <p className="truncate text-xs text-base-300 mt-0.5">{song.artistName}</p>
      {selected && isPlaying && <span className="mt-2 inline-flex items-center gap-1.5 text-[9px] font-bold uppercase tracking-[.16em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]"><span className="h-1.5 w-1.5 animate-pulseDot rounded-full bg-accent shadow-[0_0_6px_#00f59b]" /> Playing</span>}
    </button>
  );
}
