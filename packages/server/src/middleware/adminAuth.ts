import { NextFunction, Response } from "express"; 
import { prisma } from "@/db/prisma"; 
import { ForbiddenError } from "@/utils/errors"; 
import { AuthedRequest } from "@/middleware/auth"; 
export async function requireAdmin(req: AuthedRequest, _res: Response, next: NextFunction) { 
    const user = await prisma.user.findUnique({ 
        where: { id: req.userId! }, select: { 
            isAdmin: true } }); if (!user?.isAdmin) throw new ForbiddenError("Admin access required"); next(); }