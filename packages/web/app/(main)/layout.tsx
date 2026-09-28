"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/authContext";
import { Sidebar } from "@/components/layout/Sidebar";
import { MobileNav } from "@/components/layout/MobileNav";
import { Player } from "@/components/layout/Player";

export default function MainLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return <div className="flex h-screen items-center justify-center bg-base-950 text-base-400"><span className="mr-3 h-2 w-2 animate-pulse rounded-full bg-accent" />Tuning your room…</div>;
  }
  if (!user) return null;

  return (
    <div className="relative flex h-[100dvh] flex-col overflow-hidden bg-base-950">
      <div className="pointer-events-none absolute -top-48 left-[34%] h-[32rem] w-[44rem] ambient-orb" />
      <div className="relative flex min-h-0 flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" className="min-w-0 flex-1 overflow-y-auto pb-36 md:pb-0"><div className="page-enter min-h-full">{children}</div></main>
      </div>
      <MobileNav />
      <Player />
    </div>
  );
}
