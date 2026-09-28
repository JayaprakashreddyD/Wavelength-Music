"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { AudioLines, Home, Search, Library, ListMusic, Heart, Download, UploadCloud, Radio, LogOut, Sparkles } from "lucide-react";
import { useAuth } from "@/lib/authContext";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Your Library", icon: Library },
  { href: "/liked", label: "Liked Songs", icon: Heart },
  { href: "/playlists", label: "Playlists", icon: ListMusic },
  { href: "/downloads", label: "Downloads", icon: Download },
  { href: "/upload", label: "Upload Music", icon: UploadCloud },
  { href: "/rooms", label: "Rooms", icon: Radio },
];

export function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();

  return (
    <aside className="relative hidden w-[252px] shrink-0 flex-col border-r border-white/[0.08] bg-[#080d16]/95 px-4 py-5 md:flex backdrop-blur-2xl">
      <Link href="/" className="mb-8 flex items-center gap-3 px-2 group" aria-label="Wavelength home">
        <span className="relative flex h-10 w-10 items-center justify-center overflow-hidden rounded-[14px] border border-accent/40 bg-gradient-to-br from-accent/25 via-accent/10 to-transparent text-accent-bright shadow-[0_0_20px_rgba(0,245,155,0.3)] transition-transform duration-300 group-hover:scale-105">
          <span className="absolute inset-x-1 bottom-0 h-px bg-gradient-to-r from-transparent via-accent to-transparent" />
          <AudioLines size={20} strokeWidth={2} className="drop-shadow-[0_0_6px_rgba(0,245,155,0.7)]" />
        </span>
        <span>
          <span className="block text-lg font-bold tracking-tight text-white">Wavelength</span>
          <span className="block text-[10px] font-semibold uppercase tracking-[.22em] text-accent-bright">Music room</span>
        </span>
      </Link>

      <nav aria-label="Primary navigation" className="flex-1 space-y-1">
        {NAV.map(({ href, label, icon: Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "group relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-[13px] font-medium transition-all duration-200",
                active
                  ? "bg-accent/[0.13] text-accent-bright font-semibold shadow-[inset_0_0_0_1px_rgba(0,245,155,.32),0_0_20px_rgba(0,245,155,0.1)]"
                  : "text-base-300 hover:bg-white/[0.06] hover:text-white"
              )}
            >
              <Icon size={17} strokeWidth={active ? 2.2 : 1.8} className={active ? "drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]" : ""} />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="mb-4 rounded-2xl border border-accent/25 bg-gradient-to-br from-accent/[0.09] via-white/[0.03] to-transparent p-3.5 shadow-[0_0_25px_rgba(0,245,155,0.06)]">
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-accent-bright">
          <Sparkles size={13} className="text-accent-bright drop-shadow-[0_0_5px_rgba(0,245,155,0.7)]" /> Listening together
        </div>
        <p className="text-xs leading-relaxed text-base-300">Find your frequency. Share a room and listen in sync.</p>
      </div>
      <div className="border-t border-white/[0.08] pt-4">
        <Link href="/profile" className="flex min-h-12 items-center gap-3 rounded-xl px-3 transition-colors hover:bg-white/[0.05]">
          <div className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border border-accent/30 bg-gradient-to-br from-accent/20 to-base-800 text-xs font-bold uppercase text-accent-bright shadow-[0_0_12px_rgba(0,245,155,0.2)]">
            {user?.profileImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={user.profileImage} alt={user.username} className="h-8 w-8 rounded-full object-cover" />
            ) : (
              user?.username?.slice(0, 2)
            )}
          </div>
          <span className="truncate text-sm font-medium text-white">{user?.username}</span>
        </Link>
        <button
          onClick={() => logout()}
          className="mt-1 flex min-h-11 w-full items-center gap-3 rounded-xl px-3 text-sm text-base-400 transition-colors hover:bg-rose-500/10 hover:text-rose-300"
        >
          <LogOut size={16} /> Log out
        </button>
      </div>
    </aside>
  );
}
