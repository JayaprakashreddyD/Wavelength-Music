import { NextFunction, Request, Response } from "express";
import { ZodSchema } from "zod";

type Target = "body" | "query" | "params";

export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, res: Response, next: NextFunction) => {
    const parsed = schema.parse(req[target]);
    (req as any)[target] = parsed;
    next();
  };
}
