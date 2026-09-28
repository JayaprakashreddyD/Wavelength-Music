CREATE TABLE "EmailChangeVerification" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "newEmail" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmailChangeVerification_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EmailChangeVerification_tokenHash_key" ON "EmailChangeVerification"("tokenHash");
CREATE UNIQUE INDEX "EmailChangeVerification_newEmail_key" ON "EmailChangeVerification"("newEmail");
CREATE INDEX "EmailChangeVerification_userId_idx" ON "EmailChangeVerification"("userId");
CREATE INDEX "EmailChangeVerification_expiresAt_idx" ON "EmailChangeVerification"("expiresAt");

ALTER TABLE "EmailChangeVerification"
ADD CONSTRAINT "EmailChangeVerification_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Invalidate legacy raw UUID reset tokens before the API switches to HMAC hashes.
UPDATE "PasswordResetToken"
SET "usedAt" = CURRENT_TIMESTAMP
WHERE "usedAt" IS NULL AND LENGTH("token") <> 64;
