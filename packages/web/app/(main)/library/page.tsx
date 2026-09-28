"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { Song } from "@/lib/types";
import { SongRow } from "@/components/music/SongRow";
import { AddToPlaylistModal } from "@/components/music/AddToPlaylistModal";
import { Skeleton } from "@/components/ui/Skeleton";
import { Library as LibraryIcon, UploadCloud } from "lucide-react";
import Link from "next/link";

type Sort = "recent" | "popular" | "recentlyPlayed" | "alphabetical";

const SORTS: { value: Sort; label: string }[] = [
  { value: "recent", label: "Recently added" },
  { value: "popular", label: "Most played" },
  { value: "recentlyPlayed", label: "Recently played" },
  { value: "alphabetical", label: "Alphabetical" },
];

export default function LibraryPage() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [sort, setSort] = useState<Sort>("recent");
  const [loading, setLoading] = useState(true);
  const [addingSong, setAddingSong] = useState<Song | null>(null);

  useEffect(() => {
    setLoading(true);
    api
      .get<{ items: Song[] }>(`/songs/mine?sort=${sort}&limit=50`)
      .then((res) => setSongs(res.items))
      .finally(() => setLoading(false));
  }, [sort]);

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">All the music you keep</p><h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white"><LibraryIcon className="text-accent-bright drop-shadow-[0_0_8px_rgba(0,245,155,0.6)]" size={28} />Your Library</h1><p className="mt-2 text-sm text-base-300">Your uploads, ready to play.</p></div>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as Sort)}
          aria-label="Sort your library"
          className="rounded-xl border border-white/15 bg-[#0e1724] px-3.5 py-2 text-sm font-medium text-white outline-none focus:border-accent/60 focus:ring-2 focus:ring-accent/20 transition-all"
        >
          {SORTS.map((s) => (
            <option key={s.value} value={s.value} className="bg-base-900 text-white">
              {s.label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <section className="motion-reveal relative isolate flex min-h-[18rem] items-center overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1826] to-[#070d17] px-5 py-7 sm:px-8 shadow-[0_20px_50px_rgba(0,0,0,0.4)]"><div className="pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,245,155,.18),transparent_68%)]" /><div><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl border border-accent/30 bg-accent/[0.12] text-accent-bright shadow-[0_0_15px_rgba(0,245,155,0.25)]"><UploadCloud size={19} /></span><p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Your library</p><h2 className="mt-2 text-xl font-bold tracking-tight text-white">Nothing here yet.</h2><p className="mt-1 max-w-md text-sm leading-relaxed text-base-300">Upload music or start exploring to build a collection that feels like yours.</p><div className="mt-5 flex flex-wrap gap-2.5"><Link href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-base-950 shadow-[0_0_20px_rgba(0,245,155,0.4)] transition hover:bg-accent-bright hover:shadow-[0_0_28px_rgba(0,245,155,0.6)]"><UploadCloud size={15} /> Upload music</Link><Link href="/search" className="inline-flex min-h-11 items-center rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-medium text-white transition hover:bg-white/[0.1]">Explore music</Link></div></div></section>
      ) : (
        <div className="space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          {songs.map((song) => (
            <SongRow key={song.id} song={song} queue={songs} onAddToPlaylist={setAddingSong} onDeleted={() => setSongs((s) => s.filter((x) => x.id !== song.id))} onUpdated={(updated) => setSongs((s) => s.map((x) => x.id === updated.id ? updated : x))} />
          ))}
        </div>
      )}
      <AddToPlaylistModal song={addingSong} onClose={() => setAddingSong(null)} />
    </div>
  );
}
