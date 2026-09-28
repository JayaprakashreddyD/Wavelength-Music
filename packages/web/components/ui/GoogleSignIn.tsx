"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Script from "next/script";
import { publicConfig } from "@/lib/publicConfig";

interface GoogleSignInProps {
  onCredential: (credential: string) => Promise<void>;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: { credential: string }) => void }) => void;
          renderButton: (element: HTMLElement, options: { theme: "outline"; size: "large"; width: number; text: "continue_with" }) => void;
        };
      };
    };
  }
}

export function GoogleSignIn({ onCredential }: GoogleSignInProps) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const callbackRef = useRef(onCredential);
  const [buttonReady, setButtonReady] = useState(false);
  callbackRef.current = onCredential;

  const initialize = useCallback(() => {
    const clientId = publicConfig.googleClientId;
    const google = window.google;
    if (!clientId || !google || !buttonRef.current) return;

    google.accounts.id.initialize({
      client_id: clientId,
      callback: ({ credential }) => { void callbackRef.current(credential); },
    });
    buttonRef.current.replaceChildren();
    google.accounts.id.renderButton(buttonRef.current, {
      theme: "outline",
      size: "large",
      width: Math.max(240, Math.floor(buttonRef.current.clientWidth)),
      text: "continue_with",
    });
    setButtonReady(true);
  }, []);

  useEffect(() => { initialize(); }, [initialize]);

  return (
    <>
      {publicConfig.googleClientId && <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={initialize} />}
      <div className="google-signin-slot" aria-busy={!!publicConfig.googleClientId && !buttonReady}>
        {!buttonReady && (
          <button type="button" className="auth-google-fallback" disabled aria-label="Continue with Google">
            <GoogleGlyph />
            <span>Continue with Google</span>
          </button>
        )}
        <div ref={buttonRef} className={`google-signin-widget ${buttonReady ? "google-signin-ready" : ""}`} />
      </div>
    </>
  );
}

function GoogleGlyph() {
  return (
    <svg aria-hidden="true" viewBox="0 0 48 48" className="h-[18px] w-[18px] shrink-0">
      <path fill="#4285F4" d="M43.6 24.5c0-1.4-.1-2.9-.4-4.3H24v8.1h11a9.4 9.4 0 0 1-4.2 6.2v5.2h6.8c4-3.7 6-9 6-15.2Z" />
      <path fill="#34A853" d="M24 44c5.5 0 10.1-1.8 13.5-4.8l-6.8-5.2c-1.9 1.3-4.1 2-6.7 2-5.2 0-9.6-3.5-11.2-8.2H5.8v5.3A20 20 0 0 0 24 44Z" />
      <path fill="#FBBC05" d="M12.8 27.8a12 12 0 0 1 0-7.6v-5.3H5.8a20 20 0 0 0 0 18.2l7-5.3Z" />
      <path fill="#EA4335" d="M24 12c3 0 5.7 1 7.8 3.1l5.8-5.8A19.4 19.4 0 0 0 24 4 20 20 0 0 0 5.8 14.9l7 5.3C14.4 15.5 18.8 12 24 12Z" />
    </svg>
  );
}
