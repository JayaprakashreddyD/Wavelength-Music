"use client";
import { useState, useRef, useEffect } from "react";
import { MoreHorizontal, ListPlus, Plus, Download, Trash2, Heart, Pencil } from "lucide-react";
import { Song } from "@/lib/types";
import { usePlayer } from "@/lib/playerContext";
import { useAuth } from "@/lib/authContext";
import { useLikedSongs } from "@/lib/likedSongsContext";
import { api } from "@/lib/api";
import { useToast } from "@/components/ui/Toast";
import { Modal } from "@/components/ui/Modal";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";

export function SongActionsMenu({
  song,
  onAddToPlaylist,
  onDeleted,
  onUpdated,
}: {
  song: Song;
  onAddToPlaylist?: (song: Song) => void;
  onDeleted?: () => void;
  onUpdated?: (song: Song) => void;
}) {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artistName);
  const [album, setAlbum] = useState(song.albumName ?? "");
  const [genre, setGenre] = useState(song.genre ?? "");
  const menuRef = useRef<HTMLDivElement>(null);
  const { addToQueue, roomId } = usePlayer();
  const { user } = useAuth();
  const { isLiked, toggleLike } = useLikedSongs();
  const { show } = useToast();
  const isOwner = user?.id === song.uploadedById;

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node))
        setOpen(false);
    }
    if (open) document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [open]);

  async function handleDownload() {
    setOpen(false);
    try {
      const { downloadUrl, filename } = await api.post<{
        downloadUrl: string;
        filename: string;
      }>(`/songs/${song.id}/download`);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = filename;
      a.click();
      show("Download started", "success");
    } catch {
      show("Download failed", "error");
    }
  }

  function handleAddToQueue() {
    setOpen(false);
    addToQueue(song);
    show(`Added "${song.title}" to queue`, "success");
  }

  async function handleDelete() {
    setOpen(false);
    if (!confirm(`Permanently delete "${song.title}"? This can't be undone.`))
      return;
    try {
      await api.delete(`/songs/${song.id}`);
      show("Song deleted", "success");
      onDeleted?.();
    } catch {
      show("Couldn't delete song", "error");
    }
  }

  async function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    try {
      const { song: updated } = await api.patch<{ song: Song }>(`/songs/${song.id}`, { title, artist, album, genre });
      onUpdated?.(updated);
      setEditing(false);
      show("Song details updated", "success");
    } catch {
      show("Couldn't update this song", "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="rounded-full p-1.5 text-base-400 opacity-0 transition-colors hover:bg-white/[0.08] hover:text-white group-hover:opacity-100"
      >
        <MoreHorizontal size={16} />
      </button>
      {open && (
        <div className="absolute right-0 z-20 mt-1 w-48 rounded-lg border border-white/[0.1] bg-[#0e121b] py-1 shadow-[0_20px_50px_rgba(0,0,0,0.6),0_0_0_1px_rgba(255,255,255,0.06)] backdrop-blur-xl">
          <MenuItem
            icon={<ListPlus size={14} />}
            label="Add to queue"
            onClick={handleAddToQueue}
            disabled={!!roomId}
          />
          <MenuItem
            icon={
              <Heart
                size={14}
                className={isLiked(song.id) ? "fill-accent-bright text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]" : ""}
              />
            }
            label={isLiked(song.id) ? "Remove from Liked Songs" : "Save to Liked Songs"}
            onClick={() => {
              setOpen(false);
              toggleLike(song.id, song.title);
            }}
          />
          {onAddToPlaylist && (
            <MenuItem
              icon={<Plus size={14} />}
              label="Add to playlist"
              onClick={() => {
                setOpen(false);
                onAddToPlaylist(song);
              }}
            />
          )}
          {isOwner && (
            <MenuItem
              icon={<Pencil size={14} />}
              label="Edit song details"
              onClick={() => { setOpen(false); setEditing(true); }}
            />
          )}
          {song.isDownloadable && (
            <MenuItem
              icon={<Download size={14} />}
              label="Download"
              onClick={handleDownload}
            />
          )}
          {(isOwner || user?.isAdmin) && (
            <MenuItem
              icon={<Trash2 size={14} />}
              label="Delete song"
              onClick={handleDelete}
              danger
            />
          )}
        </div>
      )}
      <Modal open={editing} onClose={() => setEditing(false)} title="Edit song details">
        <form onSubmit={handleUpdate} className="space-y-3">
          <label className="block text-xs font-medium text-base-300">Title<Input required maxLength={200} value={title} onChange={(e) => setTitle(e.target.value)} /></label>
          <label className="block text-xs font-medium text-base-300">Artist<Input required maxLength={200} value={artist} onChange={(e) => setArtist(e.target.value)} /></label>
          <label className="block text-xs font-medium text-base-300">Album<Input maxLength={200} value={album} onChange={(e) => setAlbum(e.target.value)} /></label>
          <label className="block text-xs font-medium text-base-300">Genre<Input maxLength={60} value={genre} onChange={(e) => setGenre(e.target.value)} /></label>
          <Button type="submit" disabled={saving} className="w-full">{saving ? "Saving…" : "Save changes"}</Button>
        </form>
      </Modal>
    </div>
  );
}

function MenuItem({
  icon,
  label,
  onClick,
  disabled,
  danger,
}: {
  icon: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={
        "flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors hover:bg-white/[0.07] disabled:opacity-40 " +
        (danger ? "text-rose-400 hover:text-rose-300 hover:bg-rose-500/[0.1]" : "text-base-200 hover:text-white")
      }
    >
      {icon}
      {label}
    </button>
  );
}
