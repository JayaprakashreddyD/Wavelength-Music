const production = process.env.NODE_ENV === "production";

function configured(name: string, value: string | undefined, fallback?: string): string {
  const resolved = value?.trim() || fallback;
  if (!resolved && production) throw new Error(`Missing required public environment variable: ${name}`);
  return resolved ?? "";
}

export const publicConfig = {
  apiUrl: configured("NEXT_PUBLIC_API_URL", process.env.NEXT_PUBLIC_API_URL, "http://localhost:4000/api"),
  socketUrl: configured("NEXT_PUBLIC_SOCKET_URL", process.env.NEXT_PUBLIC_SOCKET_URL, "http://localhost:4000"),
  googleClientId: configured("NEXT_PUBLIC_GOOGLE_CLIENT_ID", process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID),
};

if (production) {
  for (const [name, value] of [["NEXT_PUBLIC_API_URL", publicConfig.apiUrl], ["NEXT_PUBLIC_SOCKET_URL", publicConfig.socketUrl]] as const) {
    if (!value.startsWith("https://")) throw new Error(`${name} must use HTTPS in production`);
  }
}
