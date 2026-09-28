import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "@/lib/authContext";
import { PlayerProvider } from "@/lib/playerContext";
import { LikedSongsProvider } from "@/lib/likedSongsContext";
import { ToastProvider } from "@/components/ui/Toast";

export const metadata: Metadata = {
  title: "Wavelength — Listen together",
  description: "A music platform with real-time synchronized listening rooms.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className="font-display">
        <AuthProvider>
          <ToastProvider>
            <LikedSongsProvider>
              <PlayerProvider>{children}</PlayerProvider>
            </LikedSongsProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
