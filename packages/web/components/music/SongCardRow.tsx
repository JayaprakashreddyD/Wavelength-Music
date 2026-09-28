"use client";

import { Song } from "@/lib/types";
import { SongCard } from "@/components/music/SongCard";
import { Skeleton } from "@/components/ui/Skeleton";

export function SongCardRow({ title, songs, loading }: { title: string; songs: Song[]; loading?: boolean }) {
  if (!loading && songs.length === 0) return null;
  return (
    <section className="motion-reveal mb-9">
      <div className="mb-3 flex items-end justify-between px-6 md:px-9"><h2 className="text-lg font-semibold tracking-tight text-base-200">{title}</h2><span className="text-[10px] uppercase tracking-[.18em] text-base-400">Your wavelength</span></div>
      <div className="flex gap-3 overflow-x-auto px-6 pb-4 md:gap-4 md:px-9">
        {loading
          ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-52 w-40 shrink-0" />)
          : songs.map((song) => <SongCard key={song.id} song={song} queue={songs} />)}
      </div>
    </section>
  );
}
