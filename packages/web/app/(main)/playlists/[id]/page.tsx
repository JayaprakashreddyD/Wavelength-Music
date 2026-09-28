"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Play, Shuffle, Trash2, ListMusic, Pencil } from "lucide-react";
import { api } from "@/lib/api";
import { PlaylistDetail, Song } from "@/lib/types";
import { usePlayer } from "@/lib/playerContext";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";

export default function PlaylistDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { play, roomId } = usePlayer();
  const { show } = useToast();
  const [playlist, setPlaylist] = useState<PlaylistDetail | null>(null);
  const [loading, setLoading] = useState(true);

  function refresh() {
    setLoading(true);
    api
      .get<{ playlist: PlaylistDetail }>(`/playlists/${id}`)
      .then((res) => setPlaylist(res.playlist))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, [id]);

  const songs = playlist?.songs.map((s) => s.song) ?? [];

  async function handleRemove(songId: string) {
    await api.delete(`/playlists/${id}/songs/${songId}`);
    refresh();
  }

  async function handleRename() {
    const newName = prompt("Rename playlist", playlist?.name);
    if (!newName || !playlist) return;
    await api.patch(`/playlists/${id}`, { name: newName });
    refresh();
  }

  async function handleDelete() {
    if (!confirm("Delete this playlist? This can't be undone.")) return;
    await api.delete(`/playlists/${id}`);
    router.push("/playlists");
  }

  if (loading) {
    return (
      <div className="p-8">
        <Skeleton className="mb-4 h-40 w-40" />
        <Skeleton className="h-6 w-64" />
      </div>
    );
  }
  if (!playlist) return <p className="p-8 text-base-400">Playlist not found.</p>;

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-8 flex flex-col items-start gap-5 sm:flex-row sm:items-end sm:gap-6">
        <div className="artwork-frame flex h-32 w-32 shrink-0 items-center justify-center rounded-2xl bg-base-800 shadow-xl ring-2 ring-white/10 sm:h-40 sm:w-40">
          {playlist.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={playlist.artworkUrl} alt={`${playlist.name} artwork`} loading="lazy" className="h-full w-full rounded-2xl object-cover ring-2 ring-white/10" />
          ) : (
            <ListMusic size={40} className="text-base-600" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Playlist</p>
          <h1 className="text-3xl font-extrabold text-white">{playlist.name}</h1>
          {playlist.description && <p className="mt-1 text-sm text-base-300">{playlist.description}</p>}
          <p className="mt-2 text-sm text-base-300">{songs.length} songs</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 sm:gap-3">
            <Button onClick={() => songs[0] && play(songs[0], songs)} disabled={!!roomId || songs.length === 0}>
              <Play size={16} /> Play
            </Button>
            <Button
              variant="secondary"
              onClick={() => songs.length && play(songs[Math.floor(Math.random() * songs.length)], songs)}
              disabled={!!roomId || songs.length === 0}
            >
              <Shuffle size={16} /> Shuffle
            </Button>
            <button aria-label="Rename playlist" onClick={handleRename} className="flex h-10 w-10 items-center justify-center rounded-full text-base-400 hover:bg-white/[0.06] hover:text-base-200" title="Rename">
              <Pencil size={18} />
            </button>
            <button aria-label="Delete playlist" onClick={handleDelete} className="flex h-10 w-10 items-center justify-center rounded-full text-base-400 hover:bg-red-500/10 hover:text-rose-400" title="Delete playlist">
              <Trash2 size={18} />
            </button>
          </div>
        </div>
      </div>

      {songs.length === 0 ? (
        <div className="motion-reveal flex min-h-40 flex-col items-start justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1826] to-[#070d17] px-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]"><h2 className="text-base font-bold text-white">This collection is waiting for its first song</h2><p className="mt-1 text-sm text-base-300">Find a track in Search and add it to this playlist.</p><Link href="/search" className="mt-3 text-sm font-medium text-accent hover:text-accent-bright">Find music →</Link></div>
      ) : (
        <div className="space-y-1 rounded-2xl border border-white/[0.06] bg-white/[0.015] p-2">
          {songs.map((song, i) => (
            <PlaylistSongRow key={song.id} song={song} index={i} queue={songs} onRemove={() => handleRemove(song.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

function PlaylistSongRow({ song, index, queue, onRemove }: { song: Song; index: number; queue: Song[]; onRemove: () => void }) {
  const { play, roomId } = usePlayer();
  return (
    <div className="group flex items-center gap-4 rounded-lg border border-transparent px-3 py-2 transition-colors hover:border-accent/10 hover:bg-white/[0.05]">
      <button onClick={() => play(song, queue)} disabled={!!roomId} className="w-6 text-sm text-base-400 hover:text-accent-bright">
        {index + 1}
      </button>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={song.artworkUrl ?? "/artwork-placeholder.svg"} alt="" className="h-10 w-10 rounded object-cover ring-2 ring-white/10" />
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-white">{song.title}</p>
          <p className="truncate text-xs text-base-300">{song.artistName}</p>
        </div>
      </div>
      <button onClick={onRemove} className="opacity-0 text-base-400 hover:text-rose-400 group-hover:opacity-100">
        <Trash2 size={16} />
      </button>
    </div>
  );
}
