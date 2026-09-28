"use client";

import { useEffect, useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import { Playlist, Song } from "@/lib/types";
import { useToast } from "@/components/ui/Toast";

export function AddToPlaylistModal({ song, onClose }: { song: Song | null; onClose: () => void }) {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const { show } = useToast();

  useEffect(() => {
    if (song) api.get<{ items: Playlist[] }>("/playlists").then((res) => setPlaylists(res.items));
  }, [song]);

  async function addTo(playlistId: string) {
    if (!song) return;
    try {
      await api.post(`/playlists/${playlistId}/songs`, { songId: song.id });
      show("Added to playlist", "success");
      onClose();
    } catch {
      show("Couldn't add song", "error");
    }
  }

  return (
    <Modal open={!!song} onClose={onClose} title={`Add "${song?.title ?? ""}" to playlist`}>
      {playlists.length === 0 ? (
        <p className="text-sm text-base-300">You don&apos;t have any playlists yet.</p>
      ) : (
        <div className="max-h-64 space-y-1 overflow-y-auto">
          {playlists.map((p) => (
            <button
              key={p.id}
              onClick={() => addTo(p.id)}
              className="block w-full rounded-xl border-b border-white/[0.04] px-3 py-2.5 text-left text-sm text-base-200 transition-colors hover:bg-white/[0.08] hover:text-white"
            >
              {p.name}
            </button>
          ))}
        </div>
      )}
    </Modal>
  );
}
