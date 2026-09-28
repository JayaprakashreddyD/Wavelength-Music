"use client";

import { useEffect, useState } from "react";
import { Heart, Play, Shuffle } from "lucide-react";
import { api } from "@/lib/api";
import { Song } from "@/lib/types";
import { usePlayer } from "@/lib/playerContext";
import { useAuth } from "@/lib/authContext";
import { SongRow } from "@/components/music/SongRow";
import { AddToPlaylistModal } from "@/components/music/AddToPlaylistModal";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";

export default function LikedSongsPage() {
  const { user } = useAuth();
  const { play, roomId } = usePlayer();
  const [songs, setSongs] = useState<Song[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingSong, setAddingSong] = useState<Song | null>(null);

  function refresh() {
    setLoading(true);
    api
      .get<{ items: Song[] }>("/users/me/liked-songs")
      .then((res) => setSongs(res.items))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  function handlePlayAll(shuffle = false) {
    if (songs.length === 0) return;
    if (shuffle) {
      const shuffled = [...songs].sort(() => Math.random() - 0.5);
      play(shuffled[0], shuffled);
    } else {
      play(songs[0], songs);
    }
  }

  function handleLikeToggled(songId: string, isLiked: boolean) {
    if (!isLiked) {
      setSongs((prev) => prev.filter((s) => s.id !== songId));
    }
  }

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-8 flex flex-col gap-6 sm:flex-row sm:items-end">
        <div className="flex h-36 w-36 sm:h-44 sm:w-44 shrink-0 items-center justify-center rounded-3xl bg-gradient-to-br from-accent via-emerald-400 to-purple-600 shadow-[0_16px_50px_rgba(0,245,155,0.35),0_0_35px_rgba(168,85,247,0.3)] transition-transform hover:scale-105 duration-300">
          <Heart size={64} className="fill-white text-white drop-shadow-[0_0_15px_rgba(255,255,255,0.7)]" />
        </div>

        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">
            Playlist
          </p>
          <h1 className="mt-1 text-3xl font-extrabold text-white sm:text-4xl md:text-5xl">
            Liked Songs
          </h1>
          <p className="mt-3 text-sm text-base-300 font-medium">
            {user?.username ? `${user.username} • ` : ""}
            {songs.length} {songs.length === 1 ? "song" : "songs"}
          </p>

          {songs.length > 0 && (
            <div className="mt-4 flex items-center gap-3">
              <Button
                onClick={() => handlePlayAll(false)}
                disabled={!!roomId}
                size="md"
              >
                <Play size={18} className="fill-current" /> Play
              </Button>
              <Button
                variant="secondary"
                onClick={() => handlePlayAll(true)}
                disabled={!!roomId}
                size="md"
              >
                <Shuffle size={18} /> Shuffle
              </Button>
            </div>
          )}
        </div>
      </div>

      {loading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-14 w-full" />
          ))}
        </div>
      ) : songs.length === 0 ? (
        <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1826] to-[#070d17] p-8 text-center shadow-[0_20px_50px_rgba(0,0,0,0.4)]">
          <Heart size={40} className="mx-auto mb-3 text-accent-bright drop-shadow-[0_0_10px_rgba(0,245,155,0.4)]" />
          <h2 className="text-lg font-bold text-white">No liked songs yet</h2>
          <p className="mt-1 text-sm text-base-300">
            Tap the heart icon on any song you love to save it to this collection.
          </p>
          <Link href="/search" className="mt-4 inline-flex min-h-10 items-center text-sm font-semibold text-accent-bright hover:underline drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Find songs to love →</Link>
        </div>
      ) : (
        <div className="space-y-1 rounded-2xl border border-white/[0.08] bg-white/[0.02] p-2 shadow-[0_12px_30px_rgba(0,0,0,0.25)]">
          {songs.map((song, index) => (
            <SongRow
              key={song.id}
              song={song}
              index={index}
              queue={songs}
              onAddToPlaylist={setAddingSong}
              onDeleted={() => setSongs((s) => s.filter((x) => x.id !== song.id))}
              onLikeToggled={handleLikeToggled}
            />
          ))}
        </div>
      )}

      <AddToPlaylistModal song={addingSong} onClose={() => setAddingSong(null)} />
    </div>
  );
}
