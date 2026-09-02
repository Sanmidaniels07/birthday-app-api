-- AlterEnum
ALTER TYPE "NotificationType" ADD VALUE 'POST_REPOST';

-- CreateTable
CREATE TABLE "reposts" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "postId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reposts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "reposts_userId_createdAt_idx" ON "reposts"("userId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "reposts_postId_idx" ON "reposts"("postId");

-- CreateIndex
CREATE UNIQUE INDEX "reposts_userId_postId_key" ON "reposts"("userId", "postId");

-- AddForeignKey
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reposts" ADD CONSTRAINT "reposts_postId_fkey" FOREIGN KEY ("postId") REFERENCES "posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
