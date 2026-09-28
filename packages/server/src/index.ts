import "express-async-errors";
import http from "http";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { env } from "@/config/env";
import { apiRouter } from "@/routes";
import { errorHandler, notFoundHandler } from "@/middleware/errorHandler";
import { apiLimiter } from "@/middleware/rateLimit";
import { createSocketServer } from "@/sockets";
import { logger } from "@/utils/logger";
// Allow BigInt values (used for playback timestamps) to be sent in JSON responses.
(BigInt.prototype as any).toJSON = function () {
 return Number(this);
};

const app = express();

// Storage keys are internal implementation details and are never API fields.
app.set("json replacer", (key: string, value: unknown) =>
  key === "audioStorageKey" || key === "artworkStorageKey" ? undefined : value
);

app.set("trust proxy", env.trustProxy);
app.use(helmet());
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(null, false);
  },
  credentials: true,
}));
app.use(express.json({ limit: "2mb" }));
app.use(cookieParser());
app.use(apiLimiter);

app.use("/api", apiRouter);

app.use(notFoundHandler);
app.use(errorHandler);

const httpServer = http.createServer(app);
createSocketServer(httpServer);

httpServer.listen(env.port, () => {
  logger.info(`Server listening on port ${env.port} (${env.nodeEnv})`);
});

process.on("unhandledRejection", (reason) => {
  logger.error("Unhandled promise rejection", {
    errorName: reason instanceof Error ? reason.name : "UnknownError",
  });
});
