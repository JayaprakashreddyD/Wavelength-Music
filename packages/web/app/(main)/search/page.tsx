"use client";

import { useEffect, useState } from "react";
import { Search as SearchIcon, SearchX } from "lucide-react";
import { api } from "@/lib/api";
import { Song } from "@/lib/types";
import { Input } from "@/components/ui/Input";
import { SongRow } from "@/components/music/SongRow";
import { AddToPlaylistModal } from "@/components/music/AddToPlaylistModal";
import { Skeleton } from "@/components/ui/Skeleton";

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [addingSong, setAddingSong] = useState<Song | null>(null);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }
    const timeout = setTimeout(async () => {
      setLoading(true);
      setSearchError(false);
      try {
        const { items } = await api.get<{ items: Song[] }>(`/songs?q=${encodeURIComponent(query)}`);
        setResults(items);
      } catch {
        setSearchError(true);
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timeout);
  }, [query]);

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Find your next favorite</p><h1 className="text-3xl font-extrabold tracking-tight text-white">Search</h1><p className="mt-2 text-sm text-base-300">Songs, artists, albums and genres.</p></div>
      <div className="relative mb-7 max-w-2xl">
        <SearchIcon size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-accent-bright drop-shadow-[0_0_5px_rgba(0,245,155,0.5)]" />
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Search songs, artists, albums, and genres"
          placeholder="Search songs, artists, albums, genres…"
          className="search-shell h-12 rounded-2xl border-white/15 bg-white/[0.05] pl-11 text-sm text-white shadow-[0_12px_40px_rgba(0,0,0,.3)] focus:border-accent/60 focus:ring-2 focus:ring-accent/20"
          autoFocus
        />
      </div>

      {loading && (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      )}

      {!loading && !query.trim() && <div className="motion-reveal flex min-h-48 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.2)]"><span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full border border-accent/25 bg-accent/[0.08] text-accent-bright shadow-[0_0_15px_rgba(0,245,155,0.2)]"><SearchIcon size={18} /></span><p className="text-sm font-semibold text-white">Tune into something new</p><p className="mt-1 text-xs text-base-300">Search the community library by song, artist, album, or genre.</p></div>}

      {!loading && query && results.length === 0 && <div className="motion-reveal flex min-h-48 flex-col items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.025] px-5 text-center shadow-[0_10px_30px_rgba(0,0,0,0.2)]"><span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-base-300"><SearchX size={19} /></span><p className="text-sm font-semibold text-white">{searchError ? "Search is unavailable right now" : "No frequencies found."}</p><p className="mt-1 text-xs text-base-300">{searchError ? "Check your connection and try again." : "Try another artist, song, or keyword."}</p></div>}

      {!loading && results.length > 0 && (
        <>
        <div className="mb-3 flex items-end justify-between px-1"><h2 className="text-sm font-semibold text-white">Frequencies</h2><span className="text-xs text-base-400">{results.length} {results.length === 1 ? "track" : "tracks"}</span></div>
        <div className="space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          {results.map((song) => (
            <SongRow key={song.id} song={song} queue={results} onAddToPlaylist={setAddingSong} onDeleted={() => setResults((r) => r.filter((x) => x.id !== song.id))} onUpdated={(updated) => setResults((r) => r.map((x) => x.id === updated.id ? updated : x))} />
          ))}
        </div>
        </>
      )}
      <AddToPlaylistModal song={addingSong} onClose={() => setAddingSong(null)} />
    </div>
  );
}
