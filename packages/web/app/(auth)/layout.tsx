import Link from "next/link";
import { AudioLines } from "lucide-react";

function WaveMark({ className = "" }: { className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 40 40" className={className} fill="none">
      <path d="M4 22c4.2 0 4.2-8 8.4-8s4.2 12 8.4 12 4.2-16 8.4-16 4.2 12 6.8 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path d="M4 28c4.2 0 4.2-5 8.4-5s4.2 7 8.4 7 4.2-9 8.4-9 4.2 7 6.8 7" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" opacity=".44" />
    </svg>
  );
}

function WavelengthArtwork({ id }: { id: string }) {
  return (
    <svg className="auth-wave" viewBox="0 0 820 360" fill="none" aria-hidden="true" preserveAspectRatio="xMidYMid meet">
      <defs>
        <linearGradient id={id} x1="54" y1="0" x2="766" y2="360" gradientUnits="userSpaceOnUse"><stop stopColor="#83e6c0" stopOpacity="0" /><stop offset=".35" stopColor="#83e6c0" stopOpacity=".56" /><stop offset=".7" stopColor="#91d9d5" stopOpacity=".33" /><stop offset="1" stopColor="#78bce8" stopOpacity="0" /></linearGradient>
      </defs>
      <path className="auth-wave-line auth-wave-back" d="M-18 208C69 208 83 145 160 145s95 101 175 101 98-160 182-160 89 111 171 111 81-65 150-65" stroke={`url(#${id})`} strokeWidth="1.2" />
      <path className="auth-wave-line auth-wave-main" d="M-28 234C58 234 80 111 166 111s92 157 176 157 99-207 186-207 91 164 174 164 89-97 150-97" stroke={`url(#${id})`} strokeWidth="1.8" />
      <path className="auth-wave-line auth-wave-front" d="M-26 251C54 251 81 185 162 185s97 67 180 67 99-123 186-123 88 101 171 101 85-55 153-55" stroke={`url(#${id})`} strokeWidth=".9" opacity=".72" />
      <path d="M0 180h820" stroke={`url(#${id})`} strokeWidth=".5" opacity=".2" />
    </svg>
  );
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-experience">
      <div className="auth-backdrop" aria-hidden="true"><span /><span /><span /></div>
      <div className="auth-shell">
        <aside className="auth-story">
          <Link href="/login" className="auth-brand" aria-label="Wavelength sign in">
            <span className="auth-brand-mark"><WaveMark className="h-9 w-9" /></span>
            <span className="auth-brand-name">Wavelength</span>
          </Link>
          <div className="auth-story-copy">
            <p className="auth-eyebrow"><AudioLines size={14} /> MUSIC, IN SYNC</p>
            <h2>Find your<br /><span>shared frequency.</span></h2>
            <p className="auth-story-description">A listening room for the songs that bring us closer. Discover your next favorite, or press play together.</p>
          </div>
          <div className="auth-wave-wrap"><WavelengthArtwork id="wave-mint-desktop" /></div>
          <p className="auth-story-footer">A little closer, with every song.</p>
        </aside>

        <main className="auth-main">
          <div className="auth-mobile-brand">
            <Link href="/login" className="auth-brand" aria-label="Wavelength sign in">
              <span className="auth-brand-mark"><WaveMark className="h-8 w-8" /></span>
              <span className="auth-brand-name">Wavelength</span>
            </Link>
            <p>Listen together, in sync.</p>
            <div className="auth-mobile-wave"><WavelengthArtwork id="wave-mint-mobile" /></div>
          </div>
          <div className="auth-surface">{children}</div>
          <p className="auth-legal">Your music. Your people. Your wavelength.</p>
        </main>
      </div>
    </div>
  );
}
