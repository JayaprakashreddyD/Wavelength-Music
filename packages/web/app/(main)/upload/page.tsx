"use client";

import { useState } from "react";
import Link from "next/link";
import { AudioLines, Check, ImagePlus, UploadCloud, Music2, FileAudio } from "lucide-react";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { API_URL, getAccessToken } from "@/lib/api";

export default function UploadPage() {
  const [title, setTitle] = useState("");
  const [artist, setArtist] = useState("");
  const [album, setAlbum] = useState("");
  const [genre, setGenre] = useState("");
  const [audioFile, setAudioFile] = useState<File | null>(null);
  const [artworkFile, setArtworkFile] = useState<File | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [artworkPreview, setArtworkPreview] = useState<string | null>(null);
  const [successTitle, setSuccessTitle] = useState("");
  const [audioDuration, setAudioDuration] = useState(0);
  const { show } = useToast();

  function selectAudio(file: File | null) {
    setAudioFile(file);
    setAudioDuration(0);
    if (!file) return;
    const source = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = "metadata";
    audio.onloadedmetadata = () => {
      if (Number.isFinite(audio.duration)) setAudioDuration(audio.duration);
      URL.revokeObjectURL(source);
    };
    audio.onerror = () => URL.revokeObjectURL(source);
    audio.src = source;
  }

  function reset() {
    setTitle("");
    setArtist("");
    setAlbum("");
    setGenre("");
    setAudioFile(null);
    setAudioDuration(0);
    setArtworkFile(null);
    setArtworkPreview(null);
    setRightsConfirmed(false);
    setProgress(0);
  }

  function handleUpload(e: React.FormEvent) {
    e.preventDefault();
    if (!audioFile) return show("Choose an audio file first", "error");

    const form = new FormData();
    form.append("title", title);
    form.append("artist", artist);
    if (album) form.append("album", album);
    if (genre) form.append("genre", genre);
    form.append("audio", audioFile);
    if (artworkFile) form.append("artwork", artworkFile);

    setUploading(true);
    setProgress(0);

    const xhr = new XMLHttpRequest();
    xhr.open("POST", `${API_URL}/songs/upload`);
    xhr.withCredentials = true;
    const token = getAccessToken();
    if (token) xhr.setRequestHeader("Authorization", `Bearer ${token}`);

    xhr.upload.onprogress = (evt) => {
      if (evt.lengthComputable) setProgress(Math.round((evt.loaded / evt.total) * 100));
    };
    xhr.onload = () => {
      setUploading(false);
      if (xhr.status >= 200 && xhr.status < 300) {
        setSuccessTitle(title || audioFile.name);
        show("Song uploaded", "success");
        reset();
      } else {
        try {
          const body = JSON.parse(xhr.responseText);
          show(body?.error?.message ?? "Upload failed", "error");
        } catch {
          show("Upload failed", "error");
        }
      }
    };
    xhr.onerror = () => {
      setUploading(false);
      show("Upload failed", "error");
    };
    xhr.send(form);
  }

  return (
    <div className="mx-auto max-w-3xl px-5 py-7 md:px-9 md:py-9">
      <div className="mb-7"><p className="mb-2 text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Add to the wavelength</p><h1 className="flex items-center gap-3 text-3xl font-extrabold tracking-tight text-white"><UploadCloud size={26} className="text-accent drop-shadow-[0_0_10px_rgba(0,245,155,0.5)]" />Upload music</h1><p className="mt-2 text-sm text-base-300">Share music you have the right to upload with the community.</p></div>

      <form onSubmit={handleUpload} className="surface-panel space-y-5 rounded-3xl p-5 md:p-7">
        <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-base-200"><AudioLines size={15} className="text-accent drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]" />Audio file</label>
          <div onDragEnter={(e) => { e.preventDefault(); setDragging(true); }} onDragOver={(e) => e.preventDefault()} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDragging(false); }} onDrop={(e) => { e.preventDefault(); setDragging(false); const file = e.dataTransfer.files[0]; if (file?.type.startsWith("audio/")) { selectAudio(file); setSuccessTitle(""); } else show("Choose an audio file", "error"); }} className={`upload-dropzone relative flex min-h-40 flex-col items-center justify-center overflow-hidden rounded-2xl border border-dashed px-4 py-5 text-center transition-colors ${dragging ? "border-accent bg-accent/[0.08]" : "border-white/[0.18] bg-white/[0.03] hover:border-accent/60 hover:bg-accent/[0.04]"}`}>
            <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl border border-accent/30 bg-accent/[0.1] text-accent shadow-[0_0_16px_rgba(0,245,155,0.15)]"><FileAudio size={19} /></span>
            <p className="text-sm font-bold tracking-widest text-white">{audioFile ? "TRACK READY" : "DROP YOUR TRACK HERE"}</p>
            <p className="mt-1.5 max-w-full truncate text-xs text-base-300">{audioFile ? audioFile.name : "or choose an audio file from your device"}</p>
            {audioFile && audioDuration > 0 && <p className="mt-1 text-[10px] font-medium text-base-300">{Math.floor(audioDuration / 60)}:{String(Math.floor(audioDuration % 60)).padStart(2, "0")} duration</p>}
            <Input type="file" accept="audio/*" aria-label="Choose audio file or drag it here" aria-required="true" onChange={(e) => { selectAudio(e.target.files?.[0] ?? null); setSuccessTitle(""); }} className="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0" />
            {!audioFile && <span className="pointer-events-none mt-3 inline-flex min-h-9 items-center rounded-full border border-accent/25 bg-accent/[0.06] px-4 text-xs font-medium text-accent-bright">Choose audio file</span>}
          </div>
          {audioFile && <div className="mt-2 flex items-center gap-2 text-xs text-accent"><Music2 size={13} /><span className="truncate">Ready to add metadata</span></div>}
        </div>
        <div>
          <label className="mb-2 flex items-center gap-2 text-xs font-semibold text-base-200"><ImagePlus size={15} className="text-accent drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]" />Album artwork <span className="text-base-500">(optional)</span></label>
          <Input type="file" accept="image/*" aria-label="Choose album artwork" onChange={(e) => { const file = e.target.files?.[0] ?? null; setArtworkFile(file); if (file) { const reader = new FileReader(); reader.onload = () => setArtworkPreview(typeof reader.result === "string" ? reader.result : null); reader.readAsDataURL(file); } else setArtworkPreview(null); }} className="file:mr-3 file:rounded-lg file:border file:border-accent/20 file:bg-accent/[0.08] file:px-3 file:py-2 file:text-xs file:font-medium file:text-accent-bright hover:file:bg-accent/[0.12]" />
          {artworkPreview && <img src={artworkPreview} alt="Selected album artwork preview" className="mt-3 h-16 w-16 rounded-lg object-cover ring-2 ring-accent/30 shadow-[0_0_20px_rgba(0,245,155,0.2)]" />}
          <p className="mt-2 truncate text-xs text-base-300">{artworkFile ? artworkFile.name : "Add artwork to help your song stand out"}</p>
        </div>
        </div>
        <div className="h-px bg-white/[0.07]" />
        <div>
          <label className="mb-2 block text-xs font-semibold text-base-200">Song title</label>
          <Input aria-label="Song title" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>
        <div>
          <label className="mb-2 block text-xs font-semibold text-base-200">Artist name</label>
          <Input aria-label="Artist name" value={artist} onChange={(e) => setArtist(e.target.value)} required />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-2 block text-xs font-semibold text-base-200">Album <span className="text-base-500">(optional)</span></label>
            <Input aria-label="Album name (optional)" value={album} onChange={(e) => setAlbum(e.target.value)} />
          </div>
          <div>
            <label className="mb-2 block text-xs font-semibold text-base-200">Genre <span className="text-base-500">(optional)</span></label>
            <Input aria-label="Genre (optional)" value={genre} onChange={(e) => setGenre(e.target.value)} />
          </div>
        </div>

        <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-white/[0.12] bg-white/[0.03] p-4 text-sm leading-relaxed text-base-200 transition-colors hover:border-accent/20 hover:bg-accent/[0.03]">
          <input
            type="checkbox"
            checked={rightsConfirmed}
            onChange={(e) => setRightsConfirmed(e.target.checked)}
            required
            className="mt-1 h-4 w-4 shrink-0 accent-accent"
          />
          <span>I confirm that I have the rights or permission to upload this audio.</span>
        </label>

        {uploading && (
          <div role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress} className="h-2 w-full overflow-hidden rounded-full bg-white/[0.06]">
            <div className="h-full rounded-full bg-gradient-to-r from-accent-dim to-accent-bright shadow-[0_0_10px_rgba(0,245,155,0.4)] transition-all" style={{ width: `${progress}%` }} />
          </div>
        )}

        <Button type="submit" disabled={uploading || !rightsConfirmed} className="w-full">
          {uploading ? `Uploading… ${progress}%` : "Upload"}
        </Button>
      </form>
      {successTitle && <div role="status" className="motion-reveal mt-5 flex items-center justify-between gap-4 rounded-2xl border border-accent/30 bg-accent/[0.04] px-4 py-4 shadow-[0_0_20px_rgba(0,245,155,0.1)]"><div className="flex min-w-0 items-center gap-3"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-accent/15 text-accent shadow-[0_0_12px_rgba(0,245,155,0.2)]"><Check size={17} /></span><p className="truncate text-sm text-base-200"><span className="text-accent-bright">Added to Wavelength</span><span className="text-base-300"> · {successTitle}</span></p></div><Link href="/library" className="shrink-0 text-xs font-medium text-accent hover:text-accent-bright">Open library</Link></div>}
    </div>
  );
}
