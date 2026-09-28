ALTER TABLE "User" ADD COLUMN "tokenVersion" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "EmailLoginCode" ADD COLUMN "attempts" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Song" ADD COLUMN "artworkStorageKey" TEXT;
CREATE INDEX "Song_albumName_idx" ON "Song"("albumName");
