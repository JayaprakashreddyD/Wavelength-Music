"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/authContext";
import { api } from "@/lib/api";
import { Song, RoomSummary } from "@/lib/types";
import { SongCardRow } from "@/components/music/SongCardRow";
import { RoomCard } from "@/components/rooms/RoomCard";
import Link from "next/link";
import { ArrowUpRight, Headphones, Play, UploadCloud } from "lucide-react";
import { usePlayer } from "@/lib/playerContext";
import { Artwork } from "@/components/music/Artwork";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

export default function HomePage() {
  const { user } = useAuth();
  const { currentSong, play, toggle, isPlaying, roomId } = usePlayer();
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [yourMusic, setYourMusic] = useState<Song[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Song[]>([]);
  const [recommended, setRecommended] = useState<Song[]>([]);
  const [rooms, setRooms] = useState<RoomSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [rp, mine, ra, rec, rm] = await Promise.allSettled([
        api.get<{ items: Song[] }>("/users/me/recently-played"),
        api.get<{ items: Song[] }>("/songs/mine?sort=recent&limit=12"),
        api.get<{ items: Song[] }>("/songs/recently-added"),
        api.get<{ items: Song[] }>("/songs/recommended"),
        api.get<{ items: RoomSummary[] }>("/rooms"),
      ]);
      if (rp.status === "fulfilled") setRecentlyPlayed(rp.value.items);
      if (mine.status === "fulfilled") setYourMusic(mine.value.items);
      if (ra.status === "fulfilled") setRecentlyAdded(ra.value.items);
      if (rec.status === "fulfilled") setRecommended(rec.value.items);
      if (rm.status === "fulfilled") setRooms(rm.value.items);
      setLoading(false);
    })();
  }, []);

  const featuredSong = currentSong ?? recommended[0] ?? recentlyPlayed[0] ?? yourMusic[0] ?? recentlyAdded[0] ?? null;
  const heroArtwork = featuredSong?.artworkUrl ?? "/artwork-placeholder.svg";
  const allSongs = [...recommended, ...recentlyPlayed, ...yourMusic, ...recentlyAdded];
  const hasMusic = Boolean(currentSong) || allSongs.length > 0;

  return (
    <div className="pb-8 pt-7">
      <section className="relative isolate mx-3 mb-9 min-h-[390px] overflow-hidden rounded-[2rem] border border-white/10 bg-gradient-to-br from-[#0e1826] via-[#09121d] to-[#0f1b2c] px-6 py-7 shadow-[0_24px_70px_rgba(0,0,0,0.5),0_0_50px_-15px_rgba(0,245,155,0.15)] md:mx-8 md:min-h-[410px] md:px-10 md:py-9">
        {featuredSong?.artworkUrl && <Artwork key={`glow-${featuredSong.id}`} aria-hidden={true} src={heroArtwork} alt="" className="pointer-events-none absolute -inset-12 -z-20 h-[calc(100%+6rem)] w-[calc(100%+6rem)] scale-110 object-cover opacity-[.25] blur-3xl artwork-crossfade" />}
        <div className="pointer-events-none absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(6,11,18,.96)_0%,rgba(6,11,18,.82)_48%,rgba(6,11,18,.35)_100%),linear-gradient(0deg,rgba(6,11,18,.6),transparent_45%)]" />
        <div className="pointer-events-none absolute -right-24 -top-44 -z-10 h-[36rem] w-[42rem] animate-[ambientDrift_22s_ease-in-out_infinite_alternate] rounded-full bg-[radial-gradient(circle,rgba(0,245,155,.2),rgba(56,189,248,.12)_36%,rgba(168,85,247,.08)_60%,transparent_75%)]" />
        <div className="relative grid min-h-[330px] items-center gap-8 md:grid-cols-[minmax(0,1fr)_minmax(220px,330px)]">
        <div className="max-w-2xl py-2">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/[0.12] px-3.5 py-1.5 text-[10px] font-bold uppercase tracking-[.18em] text-accent-bright shadow-[0_0_16px_rgba(0,245,155,0.2)]"><Headphones size={13} className="text-accent-bright" /> Your listening space</div>
          <h1 className="max-w-xl text-4xl font-extrabold leading-[1.04] tracking-[-.055em] text-white md:text-[3.65rem]">{greeting()}, <span className="text-gradient">{user?.username}</span></h1>
          <p className="mt-4 max-w-lg text-sm leading-relaxed text-base-300 md:text-base">Find your shared frequency. Discover a new sound, add it to your library, or bring someone along for the listen.</p>
          <div className="home-waveform mt-6 hidden h-8 items-center gap-[3px] opacity-90 sm:flex" aria-hidden="true">{[8,14,23,13,19,28,15,10,22,30,17,9,19,26,12,20,29,14,8,18,25,13,20,10,16,27,12,7,18,24,13,20,9,15,25,11].map((height, index) => <span key={index} style={{ "--bar-height": `${height}px`, "--bar-delay": `${index * -47}ms` } as React.CSSProperties} />)}</div>
          {featuredSong && <div className="mt-6 flex items-center gap-3"><span className="h-px w-7 bg-accent shadow-[0_0_6px_#00f59b]" /><span className="text-[10px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">{currentSong ? "In your player" : "A sound to start with"}</span><span className="max-w-[14rem] truncate text-xs text-white font-medium">{featuredSong.title} · {featuredSong.artistName}</span></div>}
          <div className="mt-6 flex flex-wrap gap-3">
            {featuredSong && <button disabled={!!roomId} onClick={() => currentSong ? toggle() : play(featuredSong, allSongs)} className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-6 text-sm font-bold text-base-950 shadow-[0_0_24px_rgba(0,245,155,0.45),0_4px_12px_rgba(0,245,155,0.25)] transition hover:scale-[1.03] hover:bg-accent-bright hover:shadow-[0_0_32px_rgba(0,245,155,0.65)] active:scale-[.98] disabled:opacity-40"><Play size={15} fill="currentColor" />{currentSong ? (isPlaying ? "Pause listening" : "Resume listening") : "Play now"}</button>}
            <Link href="/search" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/20 bg-white/[0.06] px-5 text-sm font-semibold text-white transition hover:bg-white/[0.12] hover:border-white/30">Explore music <ArrowUpRight size={16} /></Link>
            {!featuredSong && <Link href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-full text-sm font-semibold text-accent-bright transition hover:text-white drop-shadow-[0_0_8px_rgba(0,245,155,0.5)]"><Headphones size={15} />Add the first song</Link>}
          </div>
        </div>
        {featuredSong && <button disabled={!!roomId} onClick={() => currentSong ? toggle() : play(featuredSong, allSongs)} aria-label={`${currentSong && isPlaying ? "Pause" : "Play"} ${featuredSong.title} by ${featuredSong.artistName}`} className="group relative mx-auto aspect-square w-[min(62vw,250px)] overflow-hidden rounded-[1.35rem] border border-white/20 bg-black/30 shadow-[0_28px_75px_rgba(0,0,0,.5),0_0_30px_rgba(0,245,155,0.15)] transition duration-500 hover:-translate-y-1.5 hover:shadow-[0_35px_90px_rgba(0,0,0,.6),0_0_40px_rgba(0,245,155,0.25)] md:mr-3 md:w-full">
          <Artwork key={featuredSong.id} src={heroArtwork} alt={`${featuredSong.title} artwork`} loading="eager" className="artwork-crossfade h-full w-full object-cover transition-transform duration-700 group-hover:scale-[1.05]" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-white/[0.08]" />
          <span className="absolute bottom-4 left-4 right-4 flex items-end justify-between text-left"><span><span className="block text-[9px] font-bold uppercase tracking-[.2em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.6)]">Featured sound</span><span className="mt-1 block truncate text-sm font-bold text-white">{featuredSong.title}</span></span><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-base-950 font-bold shadow-[0_0_20px_rgba(0,245,155,0.6)] transition group-hover:scale-110 group-hover:bg-accent-bright"><Play size={18} fill="currentColor" /></span></span>
        </button>}
        </div>
      </section>

      {rooms.length > 0 && (
        <section className="motion-reveal mb-9 px-6 md:px-8">
          <div className="mb-3 flex items-end justify-between"><div><p className="mb-1 text-[9px] font-bold uppercase tracking-[.2em] text-room-bright drop-shadow-[0_0_6px_rgba(168,85,247,0.5)]">Listen together</p><h2 className="text-xl font-bold tracking-tight text-white">Rooms in motion</h2></div><Link href="/rooms" className="inline-flex min-h-11 items-center gap-1 rounded-lg px-3 text-xs font-semibold text-room-bright transition hover:bg-room/15 hover:text-white">All rooms <ArrowUpRight size={14} /></Link></div>
          <div className="motion-stagger grid gap-3 sm:grid-cols-2">
            {rooms.slice(0, 4).map((room) => (
              <RoomCard key={room.id} room={room} />
            ))}
          </div>
        </section>
      )}

      {!loading && hasMusic && rooms.length === 0 && <section className="mx-6 mb-9 flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-room/30 bg-[radial-gradient(ellipse_at_90%_50%,rgba(168,85,247,.12),transparent_50%),rgba(255,255,255,.025)] px-5 py-5 md:mx-8 md:px-6 shadow-[0_12px_35px_rgba(0,0,0,0.3)]"><div className="flex items-center gap-4"><span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-room/30 bg-room/20 text-room-bright shadow-[0_0_15px_rgba(168,85,247,0.3)]"><Headphones size={19} /></span><div><p className="text-sm font-semibold text-white">A better listen is a shared one</p><p className="mt-1 text-xs text-base-300">No active rooms yet. Start one and invite someone in.</p></div></div><Link href="/rooms" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-room/40 bg-room/15 px-4 text-xs font-semibold text-room-bright transition hover:bg-room/25 hover:shadow-[0_0_15px_rgba(168,85,247,0.4)]">Explore rooms <ArrowUpRight size={14} /></Link></section>}

      <SongCardRow title="Recommended for you" songs={recommended} loading={loading} />
      <SongCardRow title="Recently played" songs={recentlyPlayed} loading={loading} />
      <SongCardRow title="Your music" songs={yourMusic} loading={loading} />
      <SongCardRow title="Recently added" songs={recentlyAdded} loading={loading} />

      {!loading && !hasMusic && (
        <section className="motion-reveal relative isolate mx-6 mb-10 overflow-hidden rounded-[1.75rem] border border-white/[0.1] bg-gradient-to-br from-[#0d1624] to-[#070d17] px-5 py-7 sm:px-8 md:mx-8 md:py-9 shadow-[0_20px_60px_rgba(0,0,0,0.4)]">
          <div className="pointer-events-none absolute -right-14 -top-28 -z-10 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(0,245,155,.18),transparent_68%)]" />
          <div className="grid items-center gap-7 md:grid-cols-[minmax(0,1fr)_220px]">
            <div><p className="text-[10px] font-bold uppercase tracking-[.22em] text-accent-bright drop-shadow-[0_0_6px_rgba(0,245,155,0.4)]">Your wavelength is quiet</p><h2 className="mt-3 max-w-xl text-2xl font-bold tracking-[-.035em] text-white sm:text-3xl">A good listen starts somewhere.</h2><p className="mt-2 max-w-md text-sm leading-relaxed text-base-300">Upload a song, explore what others are sharing, or create a room and listen together.</p><div className="mt-5 flex flex-wrap gap-2.5"><Link href="/upload" className="inline-flex min-h-11 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-base-950 shadow-[0_0_20px_rgba(0,245,155,0.4)] transition hover:bg-accent-bright hover:shadow-[0_0_28px_rgba(0,245,155,0.6)]"><UploadCloud size={15} /> Upload music</Link><Link href="/rooms" className="inline-flex min-h-11 items-center gap-2 rounded-full border border-white/15 bg-white/[0.05] px-5 text-sm font-medium text-white transition hover:bg-white/[0.1]">Explore rooms <ArrowUpRight size={15} /></Link><Link href="/search" className="inline-flex min-h-11 items-center rounded-full px-4 text-sm text-base-300 transition hover:text-white">Discover music</Link></div></div>
            <div className="empty-wave-art hidden aspect-square items-center justify-center rounded-2xl border border-white/[0.08] bg-black/20 md:flex" aria-hidden="true"><div className="flex h-20 items-center gap-[5px]">{[15,26,39,23,50,31,66,39,23,49,29,57,34,19,44,26,63,33,20,46,27,54,31,17].map((height, index) => <span key={index} style={{ height }} />)}</div></div>
          </div>
        </section>
      )}
    </div>
  );
}
