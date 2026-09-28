"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Song } from "@/lib/types";
import { SongRow } from "@/components/music/SongRow";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { Download } from "lucide-react";

export default function DownloadsPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .get<{ items: Song[] }>("/users/me/downloads")
      .then((res) => setSongs(res.items))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-7"><p className="mb-2 text-[10px] font-semibold uppercase tracking-[.2em] text-accent">Take your music with you</p><h1 className="text-3xl font-semibold tracking-tight text-base-200">Downloads</h1><p className="mt-2 text-sm text-base-400">Songs you save for offline listening.</p></div>
      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <div className="motion-reveal flex min-h-48 flex-col items-start justify-center border-y border-white/[0.07]"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.045] text-base-300"><Download size={18} /></span><h2 className="text-lg font-medium text-base-200">Your saved tracks will be here</h2><p className="mt-1 text-sm text-base-400">Find a song and choose Download from its options.</p><Link href="/search" className="mt-4 text-sm font-medium text-accent hover:text-accent-bright">Explore music →</Link></div>
      ) : (
        <div className="space-y-1 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-2">
          {songs.map((song) => (
            <SongRow key={song.id} song={song} queue={songs} onDeleted={() => setSongs((s) => s.filter((x) => x.id !== song.id))} />
          ))}
        </div>
      )}
    </div>
  );
}
