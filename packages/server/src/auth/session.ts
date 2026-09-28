import { verifyAccessToken, verifyRefreshToken } from "@/auth/jwt";
import { prisma } from "@/db/prisma";

export async function isSessionCurrent(userId: string, tokenVersion: number | undefined): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tokenVersion: true } });
  return Boolean(user && (tokenVersion ?? 0) === user.tokenVersion);
}

export async function revokeRefreshSession(token: string): Promise<void> {
  try {
    const payload = verifyRefreshToken(token);
    await prisma.user.updateMany({
      where: { id: payload.sub, tokenVersion: payload.tokenVersion ?? 0 },
      data: { tokenVersion: { increment: 1 } },
    });
  } catch {
    // Invalid or expired tokens are already unusable; callers still clear cookies.
  }
}

export async function getCurrentUserForAccessToken(token: string) {
  const payload = verifyAccessToken(token);
  if (!(await isSessionCurrent(payload.sub, payload.tokenVersion))) return null;
  return payload;
}
