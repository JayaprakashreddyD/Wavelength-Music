import { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { AppError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { Prisma } from "@prisma/client";

export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({
    success: false,
    error: { code: "NOT_FOUND", message: `No route for ${req.method} ${req.path}` },
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction) {
  if (err instanceof ZodError) {
    res.status(422).json({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request data",
        details: err.flatten(),
      },
    });
    return;
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      res.status(409).json({ success: false, error: { code: "CONFLICT", message: "A record with that value already exists" } });
      return;
    }
    if (err.code === "P2025") {
      res.status(404).json({ success: false, error: { code: "NOT_FOUND", message: "Resource not found" } });
      return;
    }
  }

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ success: false, error: { code: err.code, message: err.message } });
    return;
  }

  const error = err instanceof Error ? err : undefined;
  logger.error("Unhandled request error", {
    method: req.method,
    path: req.path,
    errorName: error?.name ?? "UnknownError",
    errorMessage: error?.message ?? String(err),
    ...(error?.stack ? { errorStack: error.stack } : {}),
    ...(err instanceof Prisma.PrismaClientKnownRequestError ? { prismaCode: err.code } : {}),
  });
  res.status(500).json({ success: false, error: { code: "INTERNAL_ERROR", message: "Something went wrong" } });
}
