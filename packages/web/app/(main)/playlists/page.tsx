"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Plus, ListMusic as EmptyPlaylistIcon } from "lucide-react";
import { api } from "@/lib/api";
import { Playlist } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { Artwork } from "@/components/music/Artwork";

export default function PlaylistsPage() {
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState("");
  const { show } = useToast();

  function refresh() {
    setLoading(true);
    api
      .get<{ items: Playlist[] }>("/playlists")
      .then((res) => setPlaylists(res.items))
      .finally(() => setLoading(false));
  }

  useEffect(refresh, []);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    try {
      await api.post("/playlists", { name });
      setName("");
      setModalOpen(false);
      refresh();
    } catch {
      show("Couldn't create playlist", "error");
    }
  }

  return (
    <div className="px-5 py-7 md:px-9 md:py-9">
      <div className="mb-7 flex items-end justify-between gap-4">
        <div><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Collections for every mood</p><h1 className="text-3xl font-extrabold tracking-tight text-white">Playlists</h1><p className="mt-2 text-sm text-base-300">Make a collection and keep the right songs together.</p></div>
        <Button size="sm" onClick={() => setModalOpen(true)}>
          <Plus size={16} /> New playlist
        </Button>
      </div>

      {loading ? (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Skeleton key={i} className="h-44 w-full" />
          ))}
        </div>
      ) : playlists.length === 0 ? (
        <div className="motion-reveal flex min-h-52 flex-col items-start justify-center rounded-2xl border border-white/10 bg-gradient-to-br from-[#0e1826] to-[#070d17] px-5 shadow-[0_20px_50px_rgba(0,0,0,0.4)]"><span className="mb-4 flex h-11 w-11 items-center justify-center rounded-full bg-accent/[0.08] text-accent"><EmptyPlaylistIcon size={19} /></span><h2 className="text-lg font-bold text-white">Give a mood its own collection</h2><p className="mt-1 text-sm text-base-300">Create a playlist, then add songs from Search or your Library.</p><Button size="sm" className="mt-4" onClick={() => setModalOpen(true)}><Plus size={15} /> Create playlist</Button></div>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
          {playlists.map((p) => (
            <Link
              key={p.id}
              href={`/playlists/${p.id}`}
              className="group rounded-2xl border border-white/[0.07] bg-white/[0.025] p-3 transition-all duration-200 hover:-translate-y-1 hover:border-accent/25 hover:bg-white/[0.05]"
            >
              <div className="artwork-frame mb-3 aspect-square overflow-hidden rounded-xl ring-2 ring-white/10"><Artwork src={p.artworkUrl} alt={`${p.name} artwork`} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.025]" /></div>
              <p className="truncate font-semibold text-white">{p.name}</p>
              <p className="text-xs text-base-300">{p.songs?.length ?? 0} songs</p>
            </Link>
          ))}
        </div>
      )}

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="New playlist">
        <form onSubmit={handleCreate} className="space-y-4">
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Playlist name" required autoFocus />
          <Button type="submit" className="w-full">
            Create
          </Button>
        </form>
      </Modal>
    </div>
  );
}
