-- CreateTable
CREATE TABLE "LikedSong" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "songId" TEXT NOT NULL,
    "likedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LikedSong_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LikedSong_userId_idx" ON "LikedSong"("userId");

-- CreateIndex
CREATE INDEX "LikedSong_songId_idx" ON "LikedSong"("songId");

-- CreateIndex
CREATE UNIQUE INDEX "LikedSong_userId_songId_key" ON "LikedSong"("userId", "songId");

-- AddForeignKey
ALTER TABLE "LikedSong" ADD CONSTRAINT "LikedSong_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LikedSong" ADD CONSTRAINT "LikedSong_songId_fkey" FOREIGN KEY ("songId") REFERENCES "Song"("id") ON DELETE CASCADE ON UPDATE CASCADE;
