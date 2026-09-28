"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Home, Search, Library, Radio, UploadCloud } from "lucide-react";

const NAV = [
  { href: "/", label: "Home", icon: Home },
  { href: "/search", label: "Search", icon: Search },
  { href: "/library", label: "Library", icon: Library },
  { href: "/upload", label: "Upload", icon: UploadCloud },
  { href: "/rooms", label: "Rooms", icon: Radio },
];

export function MobileNav() {
  const pathname = usePathname();
  return (
    <nav aria-label="Mobile navigation" className="fixed bottom-[76px] left-0 right-0 z-40 flex justify-around border-t border-white/[0.08] bg-[#080d16]/95 px-2 pb-[max(.55rem,env(safe-area-inset-bottom))] pt-2 shadow-[0_-12px_40px_rgba(0,0,0,.4)] backdrop-blur-2xl md:hidden">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={clsx(
              "flex min-w-14 flex-col items-center gap-1 rounded-xl px-2 py-1 text-[10px] transition-all",
              active
                ? "text-accent-bright font-semibold drop-shadow-[0_0_8px_rgba(0,245,155,0.6)]"
                : "text-base-300 hover:text-white"
            )}
          >
            <Icon size={19} strokeWidth={active ? 2.3 : 1.8} className={active ? "drop-shadow-[0_0_6px_rgba(0,245,155,0.5)]" : ""} />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
