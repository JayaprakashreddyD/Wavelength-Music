type Level = "info" | "warn" | "error" | "debug";

function log(level: Level, message: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] [${level.toUpperCase()}] ${message}`;
  if (meta !== undefined) {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](line, meta);
  } else {
    // eslint-disable-next-line no-console
    console[level === "debug" ? "log" : level](line);
  }
}

export const logger = {
  info: (msg: string, meta?: unknown) => log("info", msg, meta),
  warn: (msg: string, meta?: unknown) => log("warn", msg, meta),
  error: (msg: string, meta?: unknown) => log("error", msg, meta),
  debug: (msg: string, meta?: unknown) => log("debug", msg, meta),
};
